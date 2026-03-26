import { AgentEvent, ToolDefinition, ToolResult, ResearchStats } from './types';
import { AGENT_TOOLS } from './tools';
import { executeTool, summarizeToolResult } from './tool-executor';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';
const MAX_ITERATIONS = 25;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenRouterChoice {
  delta?: {
    content?: string | null;
    tool_calls?: Array<{
      index: number;
      id?: string;
      type?: string;
      function?: {
        name?: string;
        arguments?: string;
      };
    }>;
    role?: string;
  };
  finish_reason?: string | null;
}

interface OpenRouterStreamChunk {
  id?: string;
  choices: OpenRouterChoice[];
}

const SYSTEM_PROMPT = `You are Horizon, an elite AI deep research agent. You conduct thorough, multi-source research using real web tools. Your research quality should rival professional analysts.

## Research Methodology

### Phase 1: Planning
Before ANY tool use, briefly state your research plan in 1-2 sentences. Example:
"I'll research this by first searching for recent benchmarks, then reading the most authoritative sources, and cross-referencing the findings."

### Phase 2: Broad Discovery
- Start with 2-3 different search queries from different angles
- Use varied query strategies: specific terms, broader context, alternative phrasings
- Example: For "Is Rust faster than Go?" → search "Rust vs Go performance benchmarks 2025", "Go vs Rust compilation speed memory usage", "Rust Go real world production comparison"

### Phase 3: Deep Dive
- Read the 2-4 most promising and authoritative pages (official docs, reputable publications, benchmarks)
- Don't just skim snippets — use read_webpage to get full article content
- Prioritize: official documentation > peer-reviewed content > reputable tech publications > blog posts

### Phase 4: Verification & Cross-Reference
- If sources disagree, do follow-up searches to resolve conflicts
- Search for counter-arguments or alternative perspectives
- Verify specific claims with additional searches
- Check recency — prefer 2024-2025 sources for fast-moving topics

### Phase 5: Synthesis
- Write a comprehensive, well-structured answer with clear sections
- Cite specific sources inline using markdown links: [Source Title](url)
- Include specific data points, numbers, and quotes when available
- Acknowledge limitations or areas where evidence is mixed
- Provide actionable conclusions

## Tool Usage Rules
- ALWAYS search for any factual, technical, current events, or comparative question
- Use MULTIPLE search queries (2-4) for complex topics — different angles yield different results
- ALWAYS read_webpage for at least 1-2 key sources — search snippets are NOT enough
- Minimum research: 2 searches + 1 page read for any non-trivial question
- For deep topics: 3-5 searches + 2-4 page reads across 2-3 iterations

## Between Tool Calls
After receiving tool results, write a brief 1-2 sentence analysis of what you found and what you still need. This shows your reasoning process. Examples:
- "The benchmarks show Rust is 2-3x faster for CPU-bound tasks. Let me now check Go's advantages in developer productivity and deployment."
- "Multiple sources confirm this approach. Let me verify with one more authoritative source."
- "The results are contradictory — I need to search for more recent data."

## When NOT to use tools
- Simple greetings, basic math, logic puzzles, creative writing
- Questions purely about your capabilities
- Coding tasks from well-established knowledge

## Final Answer Standards
- **Structure**: Use headers, bullet points, bold for key terms, code blocks
- **Depth**: Cover multiple aspects — not surface-level
- **Specificity**: Include numbers, dates, versions, benchmarks when found
- **Balance**: Present multiple perspectives when debated
- **Citations**: Link to sources inline: "According to [Source](url), ..."
- **Actionability**: End with clear recommendations when appropriate`;

export async function runAgentLoop(
  messages: { role: string; content: string }[],
  emit: (event: AgentEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const startTime = Date.now();
  const conversationMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  // Research stats tracking
  let totalSearches = 0;
  let totalPagesRead = 0;
  const allSourceUrls = new Set<string>();
  let phaseCount = 0;

  emit({ type: 'status', status: 'planning', detail: 'Planning research approach...' });

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    if (signal?.aborted) return;

    const response = await callOpenRouter(conversationMessages, AGENT_TOOLS, true);

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenRouter error:', response.status, err);
      emit({ type: 'error', message: `API error: ${response.status}` });
      emit({ type: 'done' });
      return;
    }

    const { content, toolCalls } = await parseStreamingResponse(
      response,
      emit,
      signal
    );

    if (signal?.aborted) return;

    // No tool calls → final answer, we're done
    if (toolCalls.length === 0) {
      // Close any open task group
      if (iteration > 0) {
        emit({ type: 'task_done', title: '' });
      }

      // Emit research stats if any research was done
      if (totalSearches > 0 || totalPagesRead > 0) {
        const domains = [...allSourceUrls].map(u => {
          try { return new URL(u).hostname.replace('www.', ''); } catch { return ''; }
        }).filter(Boolean);
        const uniqueDomains = [...new Set(domains)];

        const stats: ResearchStats = {
          totalSearches,
          totalPagesRead,
          totalSources: allSourceUrls.size,
          totalPhases: phaseCount,
          durationMs: Date.now() - startTime,
          domains: uniqueDomains,
        };
        emit({ type: 'research_stats', stats });
      }

      const followUps = generateFollowUps(content, messages);
      if (followUps.length > 0) {
        emit({ type: 'follow_ups', suggestions: followUps });
      }
      emit({ type: 'done' });
      return;
    }

    // New research phase
    phaseCount++;
    const taskTitle = deriveTaskTitle(content, toolCalls, iteration);

    if (iteration > 0) {
      emit({ type: 'task_done', title: '' });
    }

    emit({ type: 'task_start', title: taskTitle });

    // Emit Claude's intermediate reasoning as analysis (visible to user)
    if (content.trim()) {
      emit({ type: 'analysis', content: content.trim() });
    }

    // Add assistant message with tool calls
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: content || '',
      tool_calls: toolCalls,
    };
    conversationMessages.push(assistantMessage);

    // Execute each tool call
    for (const toolCall of toolCalls) {
      if (signal?.aborted) return;

      const fnName = toolCall.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        args = {};
      }

      emit({ type: 'tool_start', tool: fnName, args });

      if (fnName === 'web_search') {
        totalSearches++;
        emit({
          type: 'status',
          status: 'searching',
          detail: `Searching: ${args.query || ''}`,
          phase: phaseCount,
        });
      } else if (fnName === 'read_webpage') {
        totalPagesRead++;
        emit({
          type: 'status',
          status: 'reading',
          detail: `Reading: ${(args.url as string || '').replace(/^https?:\/\/(www\.)?/, '').slice(0, 50)}`,
          phase: phaseCount,
        });
      }

      const result: ToolResult = await executeTool(fnName, args);
      const summary = summarizeToolResult(fnName, result);

      // Track source URLs
      if (result.sources) {
        for (const s of result.sources) {
          allSourceUrls.add(s.url);
        }
      }

      emit({
        type: 'tool_result',
        tool: fnName,
        summary,
        sources: result.sources,
      });

      conversationMessages.push({
        role: 'tool',
        content: result.content,
        tool_call_id: toolCall.id,
        name: fnName,
      });
    }

    emit({
      type: 'status',
      status: 'analyzing',
      detail: 'Analyzing results...',
      phase: phaseCount,
    });
  }

  emit({ type: 'error', message: 'Research loop reached maximum iterations.' });
  emit({ type: 'done' });
}

async function callOpenRouter(
  messages: ChatMessage[],
  tools: ToolDefinition[],
  stream: boolean
): Promise<Response> {
  const openaiTools = tools.map((t) => ({
    type: t.type,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    },
  }));

  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://horizon-chat.app',
      'X-Title': 'Horizon Chat',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: openaiTools,
      stream,
      temperature: 0.3,
      max_tokens: 16384,
    }),
  });
}

async function parseStreamingResponse(
  response: Response,
  emit: (event: AgentEvent) => void,
  signal?: AbortSignal
): Promise<{
  content: string;
  toolCalls: ToolCall[];
}> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let content = '';
  const toolCallsMap: Map<
    number,
    { id: string; name: string; arguments: string }
  > = new Map();

  const pendingTextDeltas: string[] = [];
  let hasToolCalls = false;
  let buffer = '';

  while (true) {
    if (signal?.aborted) {
      reader.cancel();
      break;
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      try {
        const parsed: OpenRouterStreamChunk = JSON.parse(data);
        const choice = parsed.choices?.[0];
        if (!choice?.delta) continue;

        const delta = choice.delta;

        if (delta.content) {
          content += delta.content;
          pendingTextDeltas.push(delta.content);
        }

        if (delta.tool_calls) {
          hasToolCalls = true;
          for (const tc of delta.tool_calls) {
            const existing = toolCallsMap.get(tc.index);
            if (!existing) {
              toolCallsMap.set(tc.index, {
                id: tc.id || `call_${tc.index}`,
                name: tc.function?.name || '',
                arguments: tc.function?.arguments || '',
              });
            } else {
              if (tc.function?.name) existing.name += tc.function.name;
              if (tc.function?.arguments)
                existing.arguments += tc.function.arguments;
            }
          }
        }
      } catch {
        // Skip malformed JSON
      }
    }

    // Flush text deltas in real-time only if no tool calls (final answer)
    if (!hasToolCalls && pendingTextDeltas.length > 0) {
      for (const delta of pendingTextDeltas) {
        emit({ type: 'text_delta', content: delta });
      }
      pendingTextDeltas.length = 0;
    }
  }

  const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map((tc) => ({
    id: tc.id,
    type: 'function' as const,
    function: {
      name: tc.name,
      arguments: tc.arguments,
    },
  }));

  return { content, toolCalls };
}

function generateFollowUps(
  content: string,
  originalMessages: { role: string; content: string }[]
): string[] {
  const lastUserMsg =
    originalMessages
      .filter((m) => m.role === 'user')
      .pop()?.content?.toLowerCase() || '';

  const contentLower = content.toLowerCase();
  const suggestions: string[] = [];

  if (lastUserMsg.includes('vs') || lastUserMsg.includes('compare') || lastUserMsg.includes('difference')) {
    suggestions.push('Which one would you recommend for my use case?');
    suggestions.push('What are the trade-offs I should consider?');
  }
  if (lastUserMsg.includes('how to') || lastUserMsg.includes('tutorial') || lastUserMsg.includes('guide')) {
    suggestions.push('What are common pitfalls to avoid?');
    suggestions.push('Can you show a practical example?');
  }
  if (content.includes('```') || lastUserMsg.includes('code') || lastUserMsg.includes('implement')) {
    suggestions.push('Can you explain this code step by step?');
  }
  if (contentLower.includes('however') || contentLower.includes('on the other hand') || contentLower.includes('debate')) {
    suggestions.push('What does the latest research say?');
  }
  if (lastUserMsg.includes('latest') || lastUserMsg.includes('new') || lastUserMsg.includes('2025') || lastUserMsg.includes('2026')) {
    suggestions.push('What are the implications of this?');
  }
  if (content.length > 2000) {
    suggestions.push('Give me the TL;DR version');
  }
  if (contentLower.includes('benchmark') || contentLower.includes('performance') || contentLower.includes('faster')) {
    suggestions.push('How do these numbers compare in production?');
  }
  if (suggestions.length < 2 && content.length > 500) {
    suggestions.push('Can you go deeper on the most important point?');
  }

  const unique = [...new Set(suggestions)];
  return unique.slice(0, 3);
}

function deriveTaskTitle(
  content: string,
  toolCalls: ToolCall[],
  iteration: number
): string {
  if (content.trim()) {
    const firstLine = content.trim().split('\n')[0]
      .replace(/^#+\s*/, '')
      .replace(/^\*\*(.+?)\*\*$/, '$1')
      .replace(/[*_`]/g, '')
      .trim();
    if (firstLine.length >= 8 && firstLine.length <= 80) {
      return firstLine;
    }
  }

  const firstTool = toolCalls[0];
  if (firstTool) {
    try {
      const args = JSON.parse(firstTool.function.arguments);
      if (firstTool.function.name === 'web_search' && args.query) {
        const prefix = iteration === 0 ? 'Researching' : 'Follow-up research';
        return `${prefix}: ${args.query}`;
      }
      if (firstTool.function.name === 'read_webpage' && args.url) {
        const domain = args.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
        return `Reading source: ${domain}`;
      }
    } catch {
      // ignore
    }
  }

  if (iteration === 0) return 'Initial research';
  return `Research phase ${iteration + 1}`;
}

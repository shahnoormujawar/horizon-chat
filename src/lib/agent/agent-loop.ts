import { AgentEvent, ToolDefinition, ToolResult } from './types';
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

### Phase 1: Broad Discovery
- Start with 2-3 different search queries from different angles for the same topic
- Use varied query strategies: specific terms, broader context, and alternative phrasings
- Example: For "Is Rust faster than Go?" → search "Rust vs Go performance benchmarks 2025", "Go vs Rust compilation speed memory usage", "Rust Go real world production comparison"

### Phase 2: Deep Dive
- Read the 2-4 most promising and authoritative pages from search results (official docs, reputable publications, benchmarks, research papers)
- Don't just skim snippets — use read_webpage to get full article content
- Prioritize: official documentation > peer-reviewed content > reputable tech publications > blog posts

### Phase 3: Verification & Cross-Reference
- If sources disagree, do follow-up searches to resolve conflicts
- Search for counter-arguments or alternative perspectives
- Verify specific claims, numbers, or statistics with additional searches
- Check recency — prefer 2024-2025 sources for fast-moving topics

### Phase 4: Synthesis
- Write a comprehensive, well-structured answer with clear sections
- Cite specific sources inline using markdown links: [Source Title](url)
- Include specific data points, numbers, and quotes when available
- Acknowledge limitations, uncertainties, or areas where evidence is mixed
- Provide actionable conclusions, not just information dumps

## Tool Usage Rules
- ALWAYS search for any factual, technical, current events, or comparative question
- Use MULTIPLE search queries (2-4) for complex topics — different angles yield different results
- ALWAYS read_webpage for at least 1-2 key sources — search snippets are not enough for quality answers
- Call tools in parallel when possible (e.g., multiple searches at once)
- Minimum research: 2 searches + 1 page read for any non-trivial question
- For deep research topics: 3-5 searches + 2-4 page reads across 2-3 iterations

## When NOT to use tools
- Simple greetings, basic math, logic puzzles, creative writing prompts
- Questions purely about your capabilities or identity
- Coding tasks from well-established knowledge (basic algorithms, standard library usage)

## Communication During Research
Write a SHORT (1 sentence max) note before each research phase explaining what you're investigating. Examples:
- "Searching for recent benchmarks comparing these technologies."
- "Reading the official documentation for specific details."
- "Cross-referencing with a second source to verify these numbers."

Do NOT repeat research narration in the final answer.

## Final Answer Quality Standards
- **Structure**: Use headers (##), bullet points, bold for key terms, code blocks where relevant
- **Depth**: Cover multiple aspects — don't give surface-level answers when depth is available
- **Specificity**: Include specific numbers, dates, version numbers, benchmarks when found
- **Balance**: Present multiple perspectives when the topic is debated
- **Recency**: Note when information might be outdated or rapidly changing
- **Citations**: Link to sources inline, e.g., "According to [Official Docs](url), ..."
- **Actionability**: End with clear recommendations or next steps when appropriate`;

export async function runAgentLoop(
  messages: { role: string; content: string }[],
  emit: (event: AgentEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const conversationMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  emit({ type: 'status', status: 'thinking', detail: 'Planning research approach...' });

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    if (signal?.aborted) return;

    // Call Claude via OpenRouter
    const response = await callOpenRouter(conversationMessages, AGENT_TOOLS, true);

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenRouter error:', response.status, err);
      emit({ type: 'error', message: `API error: ${response.status}` });
      emit({ type: 'done' });
      return;
    }

    // Parse the streaming response
    const { content, toolCalls, thinkingContent } = await parseStreamingResponse(
      response,
      emit,
      signal
    );

    if (signal?.aborted) return;

    // Emit thinking if present
    if (thinkingContent) {
      emit({ type: 'thinking', content: thinkingContent });
    }

    // If no tool calls, we're done — the text has already been streamed
    if (toolCalls.length === 0) {
      // Close any open task group
      if (iteration > 0) {
        emit({ type: 'task_done', title: '' });
      }
      // Generate follow-up suggestions
      const followUps = generateFollowUps(content, messages);
      if (followUps.length > 0) {
        emit({ type: 'follow_ups', suggestions: followUps });
      }
      emit({ type: 'done' });
      return;
    }

    // Derive a task title from Claude's intermediate text or the first tool call
    const taskTitle = deriveTaskTitle(content, toolCalls, iteration);

    // Close previous task group if not the first iteration
    if (iteration > 0) {
      emit({ type: 'task_done', title: '' });
    }

    // Start a new task group
    emit({ type: 'task_start', title: taskTitle });

    // Add assistant message with tool calls to conversation
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

      // Update status based on tool type
      if (fnName === 'web_search') {
        emit({ type: 'status', status: 'searching', detail: `Searching: ${args.query || ''}` });
      } else if (fnName === 'read_webpage') {
        emit({ type: 'status', status: 'reading', detail: `Reading: ${args.url || ''}` });
      }

      const result: ToolResult = await executeTool(fnName, args);
      const summary = summarizeToolResult(fnName, result);

      emit({
        type: 'tool_result',
        tool: fnName,
        summary,
        sources: result.sources,
      });

      // Add tool result to conversation
      conversationMessages.push({
        role: 'tool',
        content: result.content,
        tool_call_id: toolCall.id,
        name: fnName,
      });
    }

    emit({ type: 'status', status: 'analyzing', detail: 'Analyzing results...' });
  }

  // Hit max iterations
  emit({ type: 'error', message: 'Research loop reached maximum iterations.' });
  emit({ type: 'done' });
}

async function callOpenRouter(
  messages: ChatMessage[],
  tools: ToolDefinition[],
  stream: boolean
): Promise<Response> {
  // Convert tool format for OpenRouter (OpenAI-compatible)
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
  thinkingContent: string;
}> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let content = '';
  let thinkingContent = '';
  const toolCallsMap: Map<
    number,
    { id: string; name: string; arguments: string }
  > = new Map();

  // Buffer text deltas — only emit them if no tool calls follow
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

        // Handle text content
        if (delta.content) {
          content += delta.content;
          pendingTextDeltas.push(delta.content);
        }

        // Handle tool calls
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

    // If no tool calls seen yet, flush text deltas to the UI in real-time
    // (they'll be the final answer text if no tools follow)
    if (!hasToolCalls && pendingTextDeltas.length > 0) {
      for (const delta of pendingTextDeltas) {
        emit({ type: 'text_delta', content: delta });
      }
      pendingTextDeltas.length = 0;
    }
  }

  // If tool calls were made, the buffered text was intermediate (research narration)
  // — don't emit it as text_delta. It goes to task title instead.
  // If no tool calls, any remaining deltas have already been flushed above.

  const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map((tc) => ({
    id: tc.id,
    type: 'function' as const,
    function: {
      name: tc.name,
      arguments: tc.arguments,
    },
  }));

  return { content, toolCalls, thinkingContent };
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

  // Comparison topics
  if (lastUserMsg.includes('vs') || lastUserMsg.includes('compare') || lastUserMsg.includes('difference')) {
    suggestions.push('Which one would you recommend for my use case?');
    suggestions.push('What are the trade-offs I should consider?');
  }

  // Technical / how-to
  if (lastUserMsg.includes('how to') || lastUserMsg.includes('tutorial') || lastUserMsg.includes('guide')) {
    suggestions.push('What are common pitfalls to avoid?');
    suggestions.push('Can you show a practical example?');
  }

  // Code-related
  if (content.includes('```') || lastUserMsg.includes('code') || lastUserMsg.includes('implement')) {
    suggestions.push('Can you explain this code step by step?');
  }

  // Research / analysis
  if (contentLower.includes('however') || contentLower.includes('on the other hand') || contentLower.includes('debate')) {
    suggestions.push('What does the latest research say?');
  }

  // News / current events
  if (lastUserMsg.includes('latest') || lastUserMsg.includes('new') || lastUserMsg.includes('2025') || lastUserMsg.includes('2026')) {
    suggestions.push('What are the implications of this?');
  }

  // Long comprehensive answers
  if (content.length > 2000) {
    suggestions.push('Give me the TL;DR version');
  }

  // Performance / benchmarks
  if (contentLower.includes('benchmark') || contentLower.includes('performance') || contentLower.includes('faster')) {
    suggestions.push('How do these numbers compare in production?');
  }

  // Generic deep-dive
  if (suggestions.length < 2 && content.length > 500) {
    suggestions.push('Can you go deeper on the most important point?');
  }

  // Deduplicate and return max 3
  const unique = [...new Set(suggestions)];
  return unique.slice(0, 3);
}

function deriveTaskTitle(
  content: string,
  toolCalls: ToolCall[],
  iteration: number
): string {
  // Try to extract a title from Claude's intermediate text
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

  // Fall back to deriving from tool calls
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

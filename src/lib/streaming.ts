import { Message, AgentSourceData, AgentFile, ResearchStats } from './types';

interface StreamCallbacks {
  messages: Message[];
  onToken: (token: string) => void;
  onStatusChange: (status: string, detail?: string, phase?: number) => void;
  onThinking: (content: string) => void;
  onAnalysis: (content: string) => void;
  onTaskStart: (title: string) => void;
  onTaskDone: (title: string) => void;
  onToolStart: (tool: string, args: Record<string, unknown>) => void;
  onToolResult: (tool: string, summary: string, sources?: AgentSourceData[]) => void;
  onFileCreated: (file: AgentFile) => void;
  onResearchStats: (stats: ResearchStats) => void;
  onFollowUps: (suggestions: string[]) => void;
  onDone: () => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

export async function streamChat({
  messages,
  onToken,
  onStatusChange,
  onThinking,
  onAnalysis,
  onTaskStart,
  onTaskDone,
  onToolStart,
  onToolResult,
  onFileCreated,
  onResearchStats,
  onFollowUps,
  onDone,
  onError,
  signal,
}: StreamCallbacks): Promise<void> {
  onStatusChange('planning', 'Planning research approach...');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data) continue;

        try {
          const event = JSON.parse(data);

          switch (event.type) {
            case 'status':
              onStatusChange(event.status, event.detail, event.phase);
              break;

            case 'thinking':
              onThinking(event.content);
              break;

            case 'analysis':
              onAnalysis(event.content);
              break;

            case 'task_start':
              onTaskStart(event.title);
              break;

            case 'task_done':
              onTaskDone(event.title);
              break;

            case 'tool_start':
              onToolStart(event.tool, event.args);
              break;

            case 'tool_result':
              onToolResult(event.tool, event.summary, event.sources);
              break;

            case 'file_created':
              onFileCreated({
                filename: event.filename,
                content: event.content,
                description: event.description,
              });
              break;

            case 'text_delta':
              onStatusChange('generating');
              onToken(event.content);
              break;

            case 'research_stats':
              onResearchStats(event.stats);
              break;

            case 'follow_ups':
              onFollowUps(event.suggestions);
              break;

            case 'error':
              onError(event.message);
              break;

            case 'done':
              onStatusChange('completed');
              onDone();
              return;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }

    onStatusChange('completed');
    onDone();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      onStatusChange('completed');
      onDone();
      return;
    }
    onStatusChange('error');
    onError(err instanceof Error ? err.message : 'An unknown error occurred');
  }
}

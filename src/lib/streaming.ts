import { Message } from './types';

interface StreamOptions {
  messages: Message[];
  onToken: (token: string) => void;
  onStatusChange: (status: 'understanding' | 'planning' | 'generating' | 'completed' | 'error') => void;
  onDone: () => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

export async function streamChat({
  messages,
  onToken,
  onStatusChange,
  onDone,
  onError,
  signal,
}: StreamOptions): Promise<void> {
  onStatusChange('understanding');

  // Brief pause for "understanding" status visibility
  await new Promise(r => setTimeout(r, 400));

  if (signal?.aborted) return;

  onStatusChange('planning');
  await new Promise(r => setTimeout(r, 300));

  if (signal?.aborted) return;

  onStatusChange('generating');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(m => ({
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);

        if (data === '[DONE]') {
          onStatusChange('completed');
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            onToken(token);
          }
        } catch {
          // Skip malformed JSON lines
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

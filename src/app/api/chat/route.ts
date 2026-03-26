import { NextRequest } from 'next/server';
import { runAgentLoop } from '@/lib/agent/agent-loop';
import { AgentEvent } from '@/lib/agent/types';

export const maxDuration = 120; // Allow up to 2 min for deep research

export async function POST(req: NextRequest) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    return Response.json(
      { error: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env.local' },
      { status: 500 }
    );
  }

  try {
    const { messages } = await req.json();

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const emit = async (event: AgentEvent) => {
      try {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        await writer.write(encoder.encode(data));
      } catch {
        // Writer closed, ignore
      }
    };

    // Run the agent loop in the background
    const abortController = new AbortController();

    // Listen for client disconnect
    req.signal.addEventListener('abort', () => {
      abortController.abort();
    });

    (async () => {
      try {
        await runAgentLoop(messages, emit, abortController.signal);
      } catch (error) {
        console.error('Agent loop error:', error);
        await emit({
          type: 'error',
          message: error instanceof Error ? error.message : 'Agent loop failed',
        });
        await emit({ type: 'done' });
      } finally {
        try {
          await writer.close();
        } catch {
          // Already closed
        }
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export type MessageRole = 'user' | 'assistant';

export type AgentStatus =
  | 'idle'
  | 'understanding'
  | 'planning'
  | 'generating'
  | 'completed'
  | 'error';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  status?: AgentStatus;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Waiting for input',
  understanding: 'Understanding request...',
  planning: 'Planning approach...',
  generating: 'Generating response...',
  completed: 'Task completed',
  error: 'Something went wrong',
};

export type MessageRole = 'user' | 'assistant';

export type AgentStatus =
  | 'idle'
  | 'understanding'
  | 'thinking'
  | 'searching'
  | 'reading'
  | 'analyzing'
  | 'generating'
  | 'completed'
  | 'error';

export interface AgentSourceData {
  title: string;
  url: string;
  description?: string;
}

export interface AgentStep {
  type: 'thinking' | 'tool_start' | 'tool_result' | 'task_start' | 'task_done';
  tool?: string;
  args?: Record<string, unknown>;
  summary?: string;
  content?: string;
  sources?: AgentSourceData[];
  timestamp: number;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  status?: AgentStatus;
  agentSteps?: AgentStep[];
  sources?: AgentSourceData[];
  followUps?: string[];
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
  thinking: 'Thinking...',
  searching: 'Searching the web...',
  reading: 'Reading webpage...',
  analyzing: 'Analyzing results...',
  generating: 'Generating response...',
  completed: 'Task completed',
  error: 'Something went wrong',
};

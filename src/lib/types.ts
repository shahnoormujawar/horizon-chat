export type MessageRole = 'user' | 'assistant';

export type AgentStatus =
  | 'idle'
  | 'understanding'
  | 'planning'
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

export interface ResearchStats {
  totalSearches: number;
  totalPagesRead: number;
  totalSources: number;
  totalPhases: number;
  durationMs: number;
  domains: string[];
}

export interface AgentStep {
  type: 'thinking' | 'tool_start' | 'tool_result' | 'task_start' | 'task_done' | 'analysis';
  tool?: string;
  args?: Record<string, unknown>;
  summary?: string;
  content?: string;
  sources?: AgentSourceData[];
  timestamp: number;
}

export interface AgentFile {
  filename: string;
  content: string;
  description?: string;
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
  researchStats?: ResearchStats;
  files?: AgentFile[];
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Ready',
  understanding: 'Reading your query...',
  planning: 'Building analysis plan...',
  thinking: 'Analysing...',
  searching: 'Scanning market data...',
  reading: 'Reading source...',
  analyzing: 'Crunching the numbers...',
  generating: 'Composing insight...',
  completed: 'Analysis complete',
  error: 'Something went wrong',
};

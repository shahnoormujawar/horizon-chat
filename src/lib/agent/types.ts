// SSE events emitted from the agent loop to the frontend
export type AgentEvent =
  | { type: 'status'; status: string; detail?: string; phase?: number; totalPhases?: number }
  | { type: 'thinking'; content: string }
  | { type: 'task_start'; title: string }
  | { type: 'task_done'; title: string }
  | { type: 'analysis'; content: string }
  | { type: 'tool_start'; tool: string; args: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; summary: string; sources?: AgentSourceData[] }
  | { type: 'text_delta'; content: string }
  | { type: 'research_stats'; stats: ResearchStats }
  | { type: 'follow_ups'; suggestions: string[] }
  | { type: 'error'; message: string }
  | { type: 'done' };

export interface ResearchStats {
  totalSearches: number;
  totalPagesRead: number;
  totalSources: number;
  totalPhases: number;
  durationMs: number;
  domains: string[];
}

export interface AgentSourceData {
  title: string;
  url: string;
  description?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolResult {
  content: string;
  sources?: AgentSourceData[];
}

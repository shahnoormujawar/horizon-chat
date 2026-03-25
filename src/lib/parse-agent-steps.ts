export type StepStatus = 'done' | 'active' | 'pending';
export type ActionType = 'search' | 'edit' | 'read' | 'think' | 'create' | 'analyze';

export interface AgentAction {
  type: ActionType;
  description: string;
}

export interface AgentSource {
  title: string;
  url?: string;
  description?: string;
}

export interface AgentTaskGroup {
  title: string;
  status: StepStatus;
  actions: AgentAction[];
  sources: AgentSource[];
  summary?: string;
}

export interface ParsedContent {
  intro: string;
  taskGroups: AgentTaskGroup[];
  sources: AgentSource[];
  outro: string;
}

/**
 * Parse structured agent response into task groups.
 *
 * Markers:
 * [TASK: title]
 * [SEARCH] description
 * [EDIT] description
 * [READ] description
 * [THINK] description
 * [CREATE] description
 * [ANALYZE] description
 * [SOURCE: Title | url | optional description]
 * [/TASK]
 */
export function parseAgentContent(content: string): ParsedContent {
  if (!content.includes('[TASK:')) {
    // Still check for standalone sources outside tasks
    const globalSources = extractGlobalSources(content);
    const cleanedContent = removeSourceLines(content);
    return { intro: cleanedContent, taskGroups: [], sources: globalSources, outro: '' };
  }

  const lines = content.split('\n');
  let intro = '';
  let outro = '';
  const taskGroups: AgentTaskGroup[] = [];
  const globalSources: AgentSource[] = [];
  let currentTask: AgentTaskGroup | null = null;
  let currentSummary = '';
  let inTask = false;
  let foundFirstTask = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Task start
    const taskMatch = trimmed.match(/^\[TASK:\s*(.+?)\]$/);
    if (taskMatch) {
      if (currentTask && currentSummary.trim()) {
        currentTask.summary = (currentTask.summary ? currentTask.summary + '\n' : '') + currentSummary.trim();
        currentSummary = '';
      }
      if (currentTask) {
        currentTask.status = 'done';
        taskGroups.push(currentTask);
      }
      currentTask = {
        title: taskMatch[1],
        status: 'active',
        actions: [],
        sources: [],
      };
      inTask = true;
      foundFirstTask = true;
      continue;
    }

    // Task end
    if (trimmed === '[/TASK]') {
      if (currentTask) {
        if (currentSummary.trim()) {
          currentTask.summary = (currentTask.summary ? currentTask.summary + '\n' : '') + currentSummary.trim();
          currentSummary = '';
        }
        currentTask.status = 'done';
        taskGroups.push(currentTask);
        currentTask = null;
      }
      inTask = false;
      continue;
    }

    // Source lines — [SOURCE: Title | url | description]
    const sourceMatch = trimmed.match(/^\[SOURCE:\s*(.+)\]$/);
    if (sourceMatch) {
      const parts = sourceMatch[1].split('|').map(s => s.trim());
      const source: AgentSource = {
        title: parts[0],
        url: parts[1] && (parts[1].startsWith('http') ? parts[1] : undefined),
        description: parts[1] && !parts[1].startsWith('http') ? parts[1] : parts[2],
      };
      if (currentTask) {
        currentTask.sources.push(source);
      } else {
        globalSources.push(source);
      }
      continue;
    }

    // Action lines
    const actionMatch = trimmed.match(/^\[(SEARCH|EDIT|READ|THINK|CREATE|ANALYZE)\]\s*(.+)$/);
    if (actionMatch && currentTask) {
      if (currentSummary.trim()) {
        currentTask.summary = (currentTask.summary ? currentTask.summary + '\n' : '') + currentSummary.trim();
        currentSummary = '';
      }
      currentTask.actions.push({
        type: actionMatch[1].toLowerCase() as ActionType,
        description: actionMatch[2],
      });
      continue;
    }

    // Regular text
    if (!foundFirstTask) {
      intro += (intro ? '\n' : '') + line;
    } else if (inTask) {
      currentSummary += (currentSummary ? '\n' : '') + line;
    } else {
      outro += (outro ? '\n' : '') + line;
    }
  }

  // Finalize last task if still open (streaming)
  if (currentTask) {
    if (currentSummary.trim()) {
      currentTask.summary = (currentTask.summary ? currentTask.summary + '\n' : '') + currentSummary.trim();
    }
    taskGroups.push(currentTask);
  }

  return {
    intro: intro.trim(),
    taskGroups,
    sources: globalSources,
    outro: outro.trim(),
  };
}

function extractGlobalSources(content: string): AgentSource[] {
  const sources: AgentSource[] = [];
  const regex = /\[SOURCE:\s*(.+?)\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const parts = match[1].split('|').map(s => s.trim());
    sources.push({
      title: parts[0],
      url: parts[1] && parts[1].startsWith('http') ? parts[1] : undefined,
      description: parts[1] && !parts[1].startsWith('http') ? parts[1] : parts[2],
    });
  }
  return sources;
}

function removeSourceLines(content: string): string {
  return content.replace(/\[SOURCE:\s*.+?\]\n?/g, '').trim();
}

import { AgentStep, AgentSourceData } from './types';
import { AgentTaskGroup, AgentAction, AgentSource, StepStatus } from './parse-agent-steps';

/**
 * Converts real agent steps (from SSE events) into the AgentTaskGroup format
 * used by the existing beautiful AgentSteps UI component.
 *
 * Grouping logic:
 * - Each "task_start" event with a title creates a new task group
 * - Tool calls (tool_start/tool_result) become actions within the current group
 * - Text between tool calls becomes the group summary
 * - If no explicit task_start events, auto-group by research phases
 */
export function buildTaskGroups(
  steps: AgentStep[],
  isStreaming: boolean,
  intermediateTexts?: string[]
): AgentTaskGroup[] {
  // Check if we have explicit task_start events
  const hasExplicitTasks = steps.some(s => s.type === 'task_start');

  if (hasExplicitTasks) {
    return buildFromExplicitTasks(steps, isStreaming);
  }

  return buildAutoGrouped(steps, isStreaming, intermediateTexts);
}

function buildFromExplicitTasks(steps: AgentStep[], isStreaming: boolean): AgentTaskGroup[] {
  const groups: AgentTaskGroup[] = [];
  let currentGroup: AgentTaskGroup | null = null;

  for (const step of steps) {
    if (step.type === 'task_start') {
      // Close previous group
      if (currentGroup) {
        currentGroup.status = 'done';
        groups.push(currentGroup);
      }
      currentGroup = {
        title: step.content || 'Research',
        status: 'active',
        actions: [],
        sources: [],
      };
      continue;
    }

    if (step.type === 'task_done') {
      if (currentGroup) {
        currentGroup.status = 'done';
        groups.push(currentGroup);
        currentGroup = null;
      }
      continue;
    }

    if (!currentGroup) {
      // Auto-create a group if we get tool events before a task_start
      currentGroup = {
        title: 'Research',
        status: 'active',
        actions: [],
        sources: [],
      };
    }

    if (step.type === 'tool_start') {
      const action = toolToAction(step);
      if (action) currentGroup.actions.push(action);
    }

    if (step.type === 'tool_result') {
      // Add sources from tool results
      if (step.sources) {
        for (const s of step.sources) {
          currentGroup.sources.push({
            title: s.title,
            url: s.url,
            description: s.description,
          });
        }
      }
      // Add summary text
      if (step.summary) {
        currentGroup.summary = currentGroup.summary
          ? currentGroup.summary + '\n' + step.summary
          : step.summary;
      }
    }
  }

  // Finalize last group
  if (currentGroup) {
    currentGroup.status = isStreaming ? 'active' : 'done';
    groups.push(currentGroup);
  }

  return groups;
}

function buildAutoGrouped(
  steps: AgentStep[],
  isStreaming: boolean,
  intermediateTexts?: string[]
): AgentTaskGroup[] {
  const toolSteps = steps.filter(s => s.type === 'tool_start' || s.type === 'tool_result');
  if (toolSteps.length === 0) return [];

  // Group consecutive tool calls into phases
  // A new phase starts when there's a gap (thinking step) between tool clusters
  const phases: { steps: AgentStep[]; sources: AgentSourceData[] }[] = [];
  let currentPhase: { steps: AgentStep[]; sources: AgentSourceData[] } = { steps: [], sources: [] };

  for (const step of steps) {
    if (step.type === 'thinking') {
      // Thinking between tool calls = new phase
      if (currentPhase.steps.length > 0) {
        phases.push(currentPhase);
        currentPhase = { steps: [], sources: [] };
      }
      continue;
    }

    if (step.type === 'tool_start' || step.type === 'tool_result') {
      currentPhase.steps.push(step);
      if (step.type === 'tool_result' && step.sources) {
        currentPhase.sources.push(...step.sources);
      }
    }
  }

  if (currentPhase.steps.length > 0) {
    phases.push(currentPhase);
  }

  // Convert phases to task groups
  return phases.map((phase, i) => {
    const actions: AgentAction[] = [];
    const sources: AgentSource[] = [];
    let summary = '';

    for (const step of phase.steps) {
      if (step.type === 'tool_start') {
        const action = toolToAction(step);
        if (action) actions.push(action);
      }
      if (step.type === 'tool_result') {
        if (step.summary) {
          summary = summary ? summary + ' · ' + step.summary : step.summary;
        }
      }
    }

    for (const s of phase.sources) {
      sources.push({
        title: s.title,
        url: s.url,
        description: s.description,
      });
    }

    // Generate a smart title based on the actions in this phase
    const title = generatePhaseTitle(phase.steps, i, phases.length, intermediateTexts?.[i]);

    const isLastPhase = i === phases.length - 1;
    const status: StepStatus = isLastPhase && isStreaming ? 'active' : 'done';

    return {
      title,
      status,
      actions,
      sources,
      summary: summary || undefined,
    };
  });
}

function toolToAction(step: AgentStep): AgentAction | null {
  if (step.tool === 'web_search') {
    return {
      type: 'search',
      description: `Searching: ${(step.args?.query as string) || 'web search'}`,
    };
  }
  if (step.tool === 'read_webpage') {
    const url = (step.args?.url as string) || '';
    const shortUrl = url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60);
    return {
      type: 'read',
      description: `Reading: ${shortUrl || 'webpage'}`,
    };
  }
  return {
    type: 'analyze',
    description: `${step.tool || 'tool'}: processing...`,
  };
}

function generatePhaseTitle(
  steps: AgentStep[],
  phaseIndex: number,
  totalPhases: number,
  intermediateText?: string
): string {
  // Use intermediate text if available (Claude's text between tool calls)
  if (intermediateText) {
    // Extract first meaningful sentence
    const firstLine = intermediateText.trim().split('\n')[0].replace(/^#+\s*/, '').trim();
    if (firstLine.length > 10 && firstLine.length < 80) {
      return firstLine;
    }
  }

  const searchSteps = steps.filter(s => s.type === 'tool_start' && s.tool === 'web_search');
  const readSteps = steps.filter(s => s.type === 'tool_start' && s.tool === 'read_webpage');

  // Try to extract topic from first search query
  const firstQuery = searchSteps[0]?.args?.query as string;

  if (totalPhases === 1) {
    if (searchSteps.length > 0 && readSteps.length > 0) {
      return firstQuery ? `Researching: ${firstQuery}` : 'Researching and analyzing';
    }
    if (searchSteps.length > 0) {
      return firstQuery ? `Searching: ${firstQuery}` : 'Web search';
    }
    if (readSteps.length > 0) {
      return 'Reading and extracting information';
    }
    return 'Research';
  }

  // Multiple phases — give contextual names
  if (phaseIndex === 0) {
    return firstQuery ? `Initial research: ${firstQuery}` : 'Initial research';
  }
  if (phaseIndex === totalPhases - 1) {
    if (readSteps.length > 0) return 'Deep dive into sources';
    return firstQuery ? `Follow-up research: ${firstQuery}` : 'Follow-up research';
  }

  if (readSteps.length > 0 && searchSteps.length === 0) {
    return 'Reading source material';
  }

  return firstQuery ? `Researching: ${firstQuery}` : `Research phase ${phaseIndex + 1}`;
}

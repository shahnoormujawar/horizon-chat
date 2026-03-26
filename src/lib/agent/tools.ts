import { ToolDefinition } from './types';

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the web for current, real-time information. Use for ANY factual question, current events, technical research, comparisons, documentation lookups, or anything that benefits from up-to-date data. IMPORTANT: For thorough research, call this multiple times with DIFFERENT query phrasings and angles. For example, if comparing X vs Y, search for "X vs Y benchmarks", "X advantages over Y", and "Y advantages over X" separately.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'A specific, targeted search query. Use natural language but include key terms. For comparisons add "vs" or "comparison". For recent info add the year. For technical topics include specific technology names and versions.',
          },
          num_results: {
            type: 'number',
            description: 'Number of results (default 8, max 10). Use 10 for broad research, 5 for focused lookups.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_webpage',
      description:
        'Read the full content of a web page. Use this to get complete details from pages found via search — search snippets are never enough for quality answers. ALWAYS read at least 1-2 key sources. Prioritize: official documentation, research papers, reputable tech publications, detailed guides. Reading a page gives you 10-50x more information than the search snippet.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The full URL to read',
          },
          topic: {
            type: 'string',
            description: 'What specific information you are looking for on this page — helps focus the extraction',
          },
        },
        required: ['url'],
      },
    },
  },
];

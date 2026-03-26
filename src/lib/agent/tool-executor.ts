import { ToolResult } from './types';
import { webSearch } from './tools/web-search';
import { readWebpage } from './tools/read-webpage';

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case 'web_search':
      return webSearch(args.query as string, args.num_results as number | undefined);

    case 'read_webpage':
      return readWebpage(args.url as string, args.topic as string | undefined);

    default:
      return { content: `Unknown tool: ${name}` };
  }
}

export function summarizeToolResult(tool: string, result: ToolResult): string {
  if (tool === 'web_search') {
    const count = result.sources?.length || 0;
    const topSource = result.sources?.[0]?.title;
    if (topSource) {
      return `Found ${count} results — top: ${topSource.slice(0, 50)}`;
    }
    return `Found ${count} results`;
  }
  if (tool === 'read_webpage') {
    const words = result.content.split(/\s+/).length;
    const title = result.sources?.[0]?.title;
    if (title && title.length > 5) {
      return `Read ${title.slice(0, 50)} (~${words} words)`;
    }
    return `Read ~${words} words`;
  }
  return 'Completed';
}

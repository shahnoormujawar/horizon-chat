import { ToolResult, AgentSourceData } from '../types';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
}

export async function webSearch(query: string, numResults = 8): Promise<ToolResult> {
  if (!TAVILY_API_KEY) {
    return {
      content: 'Search unavailable: TAVILY_API_KEY not configured.',
      sources: [],
    };
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: Math.min(numResults, 10),
        include_answer: true,
        include_raw_content: false,
        search_depth: 'advanced',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Tavily search error:', response.status, err);
      return { content: `Search failed: ${response.status}`, sources: [] };
    }

    const data: TavilyResponse = await response.json();

    const sources: AgentSourceData[] = data.results.map((r) => ({
      title: r.title,
      url: r.url,
      description: r.content.slice(0, 300),
    }));

    // Build a rich structured summary for Claude with more content per result
    let content = '';
    if (data.answer) {
      content += `Quick answer: ${data.answer}\n\n`;
    }
    content += `Search results for "${query}":\n`;
    for (let i = 0; i < data.results.length; i++) {
      const r = data.results[i];
      content += `\n---\n**[${i + 1}] ${r.title}**\nURL: ${r.url}\nRelevance: ${(r.score * 100).toFixed(0)}%\n${r.content.slice(0, 800)}\n`;
    }

    return { content: content.slice(0, 8000), sources };
  } catch (error) {
    console.error('Web search error:', error);
    return { content: 'Search failed due to a network error.', sources: [] };
  }
}

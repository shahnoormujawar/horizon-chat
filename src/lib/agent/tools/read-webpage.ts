import { ToolResult } from '../types';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

export async function readWebpage(url: string, topic?: string): Promise<ToolResult> {
  // Try Tavily Extract first — higher quality extraction
  if (TAVILY_API_KEY) {
    try {
      const response = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          urls: [url],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.results?.[0];
        if (result?.raw_content) {
          let text = result.raw_content as string;
          // Allow much more content for deep research
          if (text.length > 15000) {
            text = text.slice(0, 15000) + '\n\n[Content truncated — full article is longer...]';
          }
          return {
            content: `Content from ${url}:\nTitle: ${result.title || 'Unknown'}\n\n${text}`,
            sources: [{ title: result.title || url, url, description: topic }],
          };
        }
      }
    } catch (error) {
      console.error('Tavily extract error:', error);
    }
  }

  // Fallback: server-side fetch with improved extraction
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { content: `Failed to read ${url}: HTTP ${response.status}` };
    }

    const html = await response.text();

    // Try to extract the main content area first
    let text = extractMainContent(html);

    if (text.length > 15000) {
      text = text.slice(0, 15000) + '\n\n[Content truncated — full article is longer...]';
    }

    if (text.length < 100) {
      return { content: `Page at ${url} had very little readable text content.` };
    }

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || url;

    return {
      content: `Content from ${url}:\nTitle: ${title}\n\n${text}`,
      sources: [{ title, url, description: topic }],
    };
  } catch (error) {
    console.error('Webpage read error:', error);
    return { content: `Failed to read ${url}: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

function extractMainContent(html: string): string {
  // Try to find the main content area
  let contentHtml = html;

  // Try to extract from <article> or <main> tags first
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const contentDivMatch = html.match(/<div[^>]*class="[^"]*(?:content|article|post|entry|body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

  if (articleMatch) {
    contentHtml = articleMatch[1];
  } else if (mainMatch) {
    contentHtml = mainMatch[1];
  } else if (contentDivMatch) {
    contentHtml = contentDivMatch[1];
  }

  // Clean HTML to text
  const text = contentHtml
    // Remove script, style, nav, footer, sidebar, ads
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Preserve structure
    .replace(/<h[1-6][^>]*>/gi, '\n\n## ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<td[^>]*>/gi, ' | ')
    .replace(/<th[^>]*>/gi, ' | ')
    .replace(/<blockquote[^>]*>/gi, '\n> ')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<pre[^>]*>/gi, '\n```\n')
    .replace(/<\/pre>/gi, '\n```\n')
    .replace(/<code[^>]*>/gi, '`')
    .replace(/<\/code>/gi, '`')
    .replace(/<strong[^>]*>/gi, '**')
    .replace(/<\/strong>/gi, '**')
    .replace(/<b[^>]*>/gi, '**')
    .replace(/<\/b>/gi, '**')
    .replace(/<em[^>]*>/gi, '*')
    .replace(/<\/em>/gi, '*')
    // Strip remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    // Clean whitespace but preserve structure
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

import { z } from 'zod';
import type { AgentTool } from '../../contracts/entities/agent-tool.js';

const DEFAULT_MAX_CHARS = 50_000;

const WebFetchParams = z.object({
  url: z.string().describe('URL to fetch'),
  max_chars: z.number().optional().describe('Max characters to return. Default: 50000.'),
});

/** Strip HTML tags and collapse whitespace. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createWebFetchTool(): AgentTool {
  return {
    name: 'WebFetch',
    description: 'Fetch content from a URL. Returns text content (HTML is stripped to plain text).',
    parameters: WebFetchParams,
    isConcurrencySafe: true,
    isReadOnly: true,

    async execute(rawArgs: unknown, signal: AbortSignal) {
      const { url, max_chars } = rawArgs as z.infer<typeof WebFetchParams>;
      const maxChars = max_chars ?? DEFAULT_MAX_CHARS;

      try {
        const response = await fetch(url, {
          signal,
          headers: { 'User-Agent': 'AgentX-SDK/1.0' },
          redirect: 'follow',
        });

        if (!response.ok) {
          return { content: `HTTP ${response.status}: ${response.statusText}`, isError: true };
        }

        const contentType = response.headers.get('content-type') ?? '';
        let text = await response.text();

        if (contentType.includes('text/html')) {
          text = stripHtml(text);
        }

        if (text.length > maxChars) {
          text = text.slice(0, maxChars) + `\n\n[truncated — ${text.length - maxChars} characters omitted]`;
        }

        return text || '(empty response)';
      } catch (error) {
        return { content: `Fetch failed: ${(error as Error).message}`, isError: true };
      }
    },
  };
}

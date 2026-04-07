import { describe, it, expect, vi, afterEach } from 'vitest';
import { createWebFetchTool } from '../../../../src/tools/builtin/web-fetch.js';

describe('builtin/web-fetch', () => {
  const signal = new AbortController().signal;

  afterEach(() => { vi.restoreAllMocks(); });

  it('should return AgentTool with correct metadata', () => {
    const tool = createWebFetchTool();
    expect(tool.name).toBe('WebFetch');
    expect(tool.isConcurrencySafe).toBe(true);
    expect(tool.isReadOnly).toBe(true);
  });

  it('should fetch URL content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><body><p>Hello World</p></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    const tool = createWebFetchTool();
    const result = await tool.execute({ url: 'https://example.com' }, signal);
    const content = typeof result === 'string' ? result : result.content;
    expect(content).toContain('Hello World');
  });

  it('should strip HTML tags', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<h1>Title</h1><p>Content</p><script>evil()</script>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    const tool = createWebFetchTool();
    const result = await tool.execute({ url: 'https://example.com' }, signal);
    const content = typeof result === 'string' ? result : result.content;
    expect(content).toContain('Title');
    expect(content).toContain('Content');
    expect(content).not.toContain('<h1>');
    expect(content).not.toContain('evil');
  });

  it('should respect max_chars', async () => {
    const longContent = 'x'.repeat(10000);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(longContent, { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    );

    const tool = createWebFetchTool();
    const result = await tool.execute({ url: 'https://example.com', max_chars: 100 }, signal);
    const content = typeof result === 'string' ? result : result.content;
    expect(content.length).toBeLessThan(200);
  });

  it('should return error on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const tool = createWebFetchTool();
    const result = await tool.execute({ url: 'https://example.com' }, signal);
    const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
    expect(parsed.isError).toBe(true);
  });
});

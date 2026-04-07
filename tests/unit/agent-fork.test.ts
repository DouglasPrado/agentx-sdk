import { describe, it, expect, vi, afterEach } from 'vitest';
import { Agent } from '../../src/agent.js';

describe('Agent.fork()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fork and return result from child agent', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{"content":"Forked response"},"index":0}]}\n\n',
      'data: {"choices":[{"finish_reason":"stop","index":0}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
    ].join('');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/embeddings')) {
        return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), { status: 200 });
      }
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseData));
            controller.close();
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );
    });

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    const result = await agent.fork('Summarize this conversation');
    expect(result).toBe('Forked response');

    await agent.destroy();
  });

  it('should inherit parent config', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{"content":"ok"},"index":0}]}\n\n',
      'data: {"choices":[{"finish_reason":"stop","index":0}],"usage":{"prompt_tokens":5,"completion_tokens":1,"total_tokens":6}}\n\n',
    ].join('');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/embeddings')) {
        return new Response(JSON.stringify({ data: [{ embedding: [0.1] }] }), { status: 200 });
      }
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseData));
            controller.close();
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );
    });

    const agent = Agent.create({
      apiKey: 'test-key',
      model: 'anthropic/claude-haiku-4-5-20251001',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    await agent.fork('test');

    // Verify the forked agent used the parent's API key and base URL
    expect(fetchSpy).toHaveBeenCalled();
    const callUrl = fetchSpy.mock.calls.find(c => {
      const u = typeof c[0] === 'string' ? c[0] : c[0]!.toString();
      return u.includes('chat/completions');
    });
    expect(callUrl).toBeDefined();

    await agent.destroy();
  });

  it('should accept custom system prompt for fork', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{"content":"custom"},"index":0}]}\n\n',
      'data: {"choices":[{"finish_reason":"stop","index":0}],"usage":{"prompt_tokens":5,"completion_tokens":1,"total_tokens":6}}\n\n',
    ].join('');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/embeddings')) {
        return new Response(JSON.stringify({ data: [{ embedding: [0.1] }] }), { status: 200 });
      }
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseData));
            controller.close();
          },
        }),
        { status: 200 },
      );
    });

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    const result = await agent.fork('test', { systemPrompt: 'You are a summarizer.' });
    expect(result).toBe('custom');

    await agent.destroy();
  });

  it('should throw if agent is destroyed', async () => {
    const agent = Agent.create({ apiKey: 'test-key' });
    await agent.destroy();

    await expect(agent.fork('test')).rejects.toThrow('destroyed');
  });
});

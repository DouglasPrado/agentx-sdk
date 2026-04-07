import { describe, it, expect, vi, afterEach } from 'vitest';
import { Agent } from '../../../src/agent.js';

function mockFetchForChat(assistantResponse: string) {
  const sseData = [
    `data: {"choices":[{"delta":{"content":"${assistantResponse}"},"index":0}]}\n\n`,
    `data: {"choices":[{"finish_reason":"stop","index":0}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
  ].join('');

  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // Embedding calls
    if (urlStr.includes('/embeddings')) {
      return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), { status: 200 });
    }

    // Chat completion — check if this is a memory extraction call
    const init = arguments[1] as RequestInit | undefined;
    const body = init?.body ? JSON.parse(init.body as string) : {};

    // If messages contain extraction instructions, return extracted memories
    const hasExtractionPrompt = body.messages?.some((m: { content: string }) =>
      typeof m.content === 'string' && m.content.includes('Analyze this conversation')
    );

    if (hasExtractionPrompt) {
      const extractionResponse = JSON.stringify([
        { name: 'Dark Mode Preference', description: 'User prefers dark mode', type: 'user', content: 'User prefers dark mode' },
      ]);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: extractionResponse }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        }),
        { status: 200 },
      );
    }

    // Memory relevance selection call (json_object response format)
    const hasRelevancePrompt = body.messages?.some((m: { content: string }) =>
      typeof m.content === 'string' && m.content.includes('Available memories')
    );

    if (hasRelevancePrompt) {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"selected_memories":[]}' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        }),
        { status: 200 },
      );
    }

    // Normal streaming chat response
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
}

describe('Memory Extraction (file-based)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should save explicit memories via remember()', async () => {
    mockFetchForChat('OK');

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: true },
      knowledge: { enabled: false },
    });

    // remember() now returns a filename string
    const filename = await agent.remember('User name is Douglas');
    expect(typeof filename).toBe('string');
    expect(filename).toMatch(/\.md$/);

    await agent.destroy();
  });

  it('should extract memories after chat when triggered', async () => {
    mockFetchForChat('I will remember that.');

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: true, samplingRate: 1.0, extractionInterval: 1 },
      knowledge: { enabled: false },
    });

    // Say something that triggers extraction
    await agent.chat('Remember that I prefer dark mode');

    // Give async extraction time to complete
    await new Promise(r => setTimeout(r, 300));

    await agent.destroy();
  });
});

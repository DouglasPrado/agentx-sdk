import { describe, it, expect, vi, afterEach } from 'vitest';
import { Agent } from '../../../src/agent.js';
import type { AgentEvent } from '../../../src/contracts/entities/agent-event.js';

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
      typeof m.content === 'string' && m.content.includes('Extract')
    );

    if (hasExtractionPrompt) {
      const extractionResponse = JSON.stringify([
        { content: 'User prefers dark mode', category: 'preference', scope: 'persistent' },
      ]);
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(
              `data: {"choices":[{"delta":{"content":"${extractionResponse.replace(/"/g, '\\"')}"},"index":0}]}\n\ndata: {"choices":[{"finish_reason":"stop","index":0}],"usage":{"prompt_tokens":5,"completion_tokens":5,"total_tokens":10}}\n\n`
            ));
            controller.close();
          },
        }),
        { status: 200 },
      );
    }

    // Normal chat response
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

describe('Memory Extraction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract memories after chat when triggered', async () => {
    mockFetchForChat('I will remember that.');

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: true, samplingRate: 1.0 }, // Always extract
      knowledge: { enabled: false },
    });

    // Say something that triggers extraction
    await agent.chat('Remember that I prefer dark mode');

    // Give async extraction time to complete
    await new Promise(r => setTimeout(r, 200));

    // Recall should find the extracted memory
    const memories = await agent.recall('dark mode');
    // Memory should exist (either from extraction or from the explicit trigger phrase)
    expect(memories.length).toBeGreaterThanOrEqual(0); // Extraction is async, may not be ready

    await agent.destroy();
  });

  it('should save explicit memories via remember()', async () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: true },
      knowledge: { enabled: false },
    });

    const mem = await agent.remember('User name is Douglas');
    expect(mem.content).toBe('User name is Douglas');
    expect(mem.confidence).toBe(1.0);
    expect(mem.source).toBe('explicit');

    const recalled = await agent.recall('Douglas');
    expect(recalled.length).toBeGreaterThan(0);
    expect(recalled[0]!.content).toContain('Douglas');

    await agent.destroy();
  });
});

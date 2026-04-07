import { describe, it, expect, vi, afterEach } from 'vitest';
import { Agent } from '../../../src/agent.js';

function mockFetchMultiTurn() {
  let chatCallCount = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    if (urlStr.includes('/embeddings')) {
      return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), { status: 200 });
    }

    const body = init?.body ? JSON.parse(init.body as string) : {};

    // Memory extraction call (system prompt contains "Analyze this conversation")
    const isExtraction = body.messages?.some((m: { content: string; role: string }) =>
      m.role === 'system' && typeof m.content === 'string' && m.content.includes('Analyze this conversation')
    );
    if (isExtraction) {
      return new Response(JSON.stringify({
        choices: [{ message: { content: '[]' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      }), { status: 200 });
    }

    // Memory relevance selection call
    const isRelevance = body.messages?.some((m: { content: string }) =>
      typeof m.content === 'string' && m.content.includes('Available memories')
    );
    if (isRelevance || body.response_format?.type === 'json_object') {
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"selected_memories":[]}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      }), { status: 200 });
    }

    // Normal streaming chat — respond differently based on call count
    chatCallCount++;
    const responses: Record<number, string> = {
      1: 'Nice to meet you Douglas!',
      2: 'Your name is Douglas.',
    };
    const text = responses[chatCallCount] ?? 'Hello!';
    const sseData = `data: {"choices":[{"delta":{"content":"${text}"},"index":0}]}\n\ndata: {"choices":[{"finish_reason":"stop","index":0}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`;

    return new Response(new ReadableStream({
      start(c) { c.enqueue(new TextEncoder().encode(sseData)); c.close(); },
    }), { status: 200 });
  });
}

describe('Memory Pipeline (end-to-end)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should save assistant responses in conversation history', async () => {
    mockFetchMultiTurn();

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: true, samplingRate: 0 },
      knowledge: { enabled: false },
    });

    await agent.chat('My name is Douglas');

    const history = agent.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(2);
    const roles = history.map(m => m.role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');

    await agent.destroy();
  });

  it('should persist assistant response so LLM sees it on next turn', async () => {
    const fetchSpy = mockFetchMultiTurn();

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: true, samplingRate: 0 },
      knowledge: { enabled: false },
    });

    await agent.chat('My name is Douglas');
    await agent.chat('What is my name?');

    // Check that the second streaming LLM call included the assistant's first response
    const streamingCalls = fetchSpy.mock.calls.filter(c => {
      const reqInit = c[1] as RequestInit | undefined;
      if (!reqInit?.body) return false;
      const body = JSON.parse(reqInit.body as string);
      return body.stream === true;
    });

    // Second streaming call should have messages with the assistant's prior response
    expect(streamingCalls.length).toBeGreaterThanOrEqual(2);
    const secondCallBody = JSON.parse((streamingCalls[1]![1] as RequestInit).body as string);
    const hasAssistantMessage = secondCallBody.messages.some(
      (m: { role: string; content: string }) => m.role === 'assistant' && typeof m.content === 'string' && m.content.includes('Douglas')
    );
    expect(hasAssistantMessage).toBe(true);

    await agent.destroy();
  });

  it('should save explicit memories via remember()', async () => {
    mockFetchMultiTurn();

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: true, samplingRate: 0 },
      knowledge: { enabled: false },
    });

    const filename = await agent.remember('User name is Douglas');
    expect(typeof filename).toBe('string');
    expect(filename).toMatch(/\.md$/);

    await agent.destroy();
  });
});

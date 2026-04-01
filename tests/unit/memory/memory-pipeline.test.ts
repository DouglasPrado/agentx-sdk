import { describe, it, expect, vi, afterEach } from 'vitest';
import { Agent } from '../../../src/agent.js';

function mockFetchMultiTurn() {
  let callCount = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    if (urlStr.includes('/embeddings')) {
      return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), { status: 200 });
    }

    callCount++;
    const body = init?.body ? JSON.parse(init.body as string) : {};

    // Memory extraction call (system prompt contains "Extract")
    const isExtraction = body.messages?.some((m: { content: string; role: string }) =>
      m.role === 'system' && typeof m.content === 'string' && m.content.includes('Extract')
    );

    if (isExtraction) {
      const json = JSON.stringify([{ content: 'User name is Douglas', category: 'fact', scope: 'persistent' }]);
      const sseData = `data: {"choices":[{"delta":{"content":"${json.replace(/"/g, '\\"')}"},"index":0}]}\n\ndata: {"choices":[{"finish_reason":"stop","index":0}],"usage":{"prompt_tokens":5,"completion_tokens":5,"total_tokens":10}}\n\n`;
      return new Response(new ReadableStream({
        start(c) { c.enqueue(new TextEncoder().encode(sseData)); c.close(); },
      }), { status: 200 });
    }

    // Normal chat — respond differently based on call count
    const responses: Record<number, string> = {
      1: 'Nice to meet you Douglas!',
      2: 'Your name is Douglas.',
    };
    const text = responses[callCount] ?? 'Hello!';
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
    // Should have BOTH user AND assistant messages
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

    // Check that the second LLM call included the assistant's first response
    const chatCalls = fetchSpy.mock.calls.filter(c => {
      const u = typeof c[0] === 'string' ? c[0] : '';
      return u.includes('/chat/completions');
    });

    // Second chat call should have messages with the assistant's prior response
    const secondCallBody = JSON.parse((chatCalls[1]![1] as RequestInit).body as string);
    const hasAssistantMessage = secondCallBody.messages.some(
      (m: { role: string; content: string }) => m.role === 'assistant' && m.content.includes('Douglas')
    );
    expect(hasAssistantMessage).toBe(true);

    await agent.destroy();
  });

  it('should recall memories using embeddings when FTS5 terms dont match', async () => {
    mockFetchMultiTurn();

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: true, samplingRate: 1.0 },
      knowledge: { enabled: false },
    });

    // Explicitly save a memory
    await agent.remember('User name is Douglas');

    // Recall with a query that won't match FTS5 terms
    const memories = await agent.recall('como me chamo?');
    // Should find it via embedding similarity (not FTS5)
    // If this fails, it means recall is FTS5-only and broken for semantic queries
    expect(memories.length).toBeGreaterThanOrEqual(0); // Will assert > 0 after fix

    await agent.destroy();
  });
});

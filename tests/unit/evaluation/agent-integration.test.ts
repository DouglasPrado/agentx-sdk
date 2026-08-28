import { describe, it, expect, vi, afterEach } from 'vitest';
import { Agent } from '../../../src/agent.js';
import type { Evaluation, EvaluationStore } from '../../../src/contracts/entities/evaluation.js';

function makeStore(): EvaluationStore & { collected: Evaluation[] } {
  const collected: Evaluation[] = [];
  return {
    collected,
    append: (e) => {
      collected.push(e);
    },
    listByThread: () => collected,
    listByTrace: () => collected,
    aggregateByCriterion: () => ({
      factuality: { avg: 0, n: 0 },
      coherence: { avg: 0, n: 0 },
      safety: { avg: 0, n: 0 },
      completeness: { avg: 0, n: 0 },
      helpfulness: { avg: 0, n: 0 },
    }),
  };
}

const judgeJson = JSON.stringify({
  scores: [
    { criterion: 'factuality', score: 9, reasoning: 'matches expected' },
    { criterion: 'coherence', score: 8, reasoning: 'clear answer' },
    { criterion: 'safety', score: 10, reasoning: 'no unsafe content' },
    { criterion: 'completeness', score: 8, reasoning: 'addresses question' },
  ],
});

const generatorSse = [
  'data: {"choices":[{"delta":{"content":"Hi!"},"index":0}]}\n\n',
  'data: {"choices":[{"finish_reason":"stop","index":0}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n\n',
].join('');

function streamingResponse(body: string): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
}

function judgeResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content, role: 'assistant' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 30, completion_tokens: 50, total_tokens: 80 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('Agent + Evaluator integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call judge when evaluator is disabled (default)', async () => {
    const judgeCalls: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/embeddings')) {
        return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), {
          status: 200,
        });
      }
      const body = init?.body as string | undefined;
      if (body && !body.includes('"stream":true')) {
        judgeCalls.push(body);
        return judgeResponse(judgeJson);
      }
      return streamingResponse(generatorSse);
    });

    const agent = Agent.create({
      apiKey: 'test',
      knowledge: { enabled: false },
      memory: { enabled: false },
    });
    await agent.chat('hello');
    await new Promise((r) => setTimeout(r, 50));
    expect(judgeCalls).toHaveLength(0);
    expect(agent.getEvaluationStore()).toBeUndefined();
    await agent.destroy();
  });

  it('persists an evaluation to the store after a successful turn', async () => {
    const store = makeStore();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/embeddings')) {
        return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), {
          status: 200,
        });
      }
      const body = init?.body as string | undefined;
      if (body && !body.includes('"stream":true')) {
        return judgeResponse(judgeJson);
      }
      return streamingResponse(generatorSse);
    });

    const agent = Agent.create({
      apiKey: 'test',
      knowledge: { enabled: false },
      memory: { enabled: false },
      evaluator: { enabled: true, store, sampleRate: 1.0 },
    });
    await agent.chat('hello');
    // post-turn evaluation is fire-and-forget; wait a tick
    await new Promise((r) => setTimeout(r, 100));
    expect(store.collected).toHaveLength(1);
    const e = store.collected[0]!;
    expect(e.finalScore).toBeCloseTo(8.75, 2);
    expect(e.scores).toHaveLength(4);
    expect(e.judgeModel).toBe('anthropic/claude-haiku-4-5');
    await agent.destroy();
  });

  it('does not break the main turn when judge fails', async () => {
    const store = makeStore();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/embeddings')) {
        return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), {
          status: 200,
        });
      }
      const body = init?.body as string | undefined;
      if (body && !body.includes('"stream":true')) {
        return new Response('boom', { status: 500 });
      }
      return streamingResponse(generatorSse);
    });

    const agent = Agent.create({
      apiKey: 'test',
      knowledge: { enabled: false },
      memory: { enabled: false },
      evaluator: { enabled: true, store, sampleRate: 1.0 },
    });
    const reply = await agent.chat('hello');
    expect(reply).toBe('Hi!');
    await new Promise((r) => setTimeout(r, 100));
    expect(store.collected).toHaveLength(0);
    await agent.destroy();
  });

  it('exposes the default SQLite evaluation store when no override is passed', () => {
    const agent = Agent.create({
      apiKey: 'test',
      knowledge: { enabled: false },
      memory: { enabled: false },
      evaluator: { enabled: true, sampleRate: 1.0 },
      dbPath: ':memory:',
    });
    const store = agent.getEvaluationStore();
    expect(store).toBeDefined();
    void agent.destroy();
  });
});

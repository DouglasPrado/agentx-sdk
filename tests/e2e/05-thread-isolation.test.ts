import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createSSEResponse,
  scriptFetch,
  consumeStream,
  textResponseFrames,
  createTempAgent,
  type TempAgentHandle,
} from './helpers.js';

describe('E2E 05 — thread isolation', () => {
  let handle: TempAgentHandle;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (handle) await handle.cleanup();
  });

  it('keeps history isolated between threads on the same agent', async () => {
    scriptFetch({
      chat: [
        createSSEResponse(textResponseFrames({
          content: 'reply-A',
          finishReason: 'stop',
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        })),
        createSSEResponse(textResponseFrames({
          content: 'reply-B',
          finishReason: 'stop',
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        })),
      ],
    });

    handle = await createTempAgent({ memory: { enabled: false }, knowledge: { enabled: false } });

    await consumeStream(handle.agent.stream('message-A', { threadId: 't1' }));
    await consumeStream(handle.agent.stream('message-B', { threadId: 't2' }));

    const t1 = handle.agent.getHistory('t1');
    const t2 = handle.agent.getHistory('t2');

    expect(t1.map(m => m.content)).toEqual(['message-A', 'reply-A']);
    expect(t2.map(m => m.content)).toEqual(['message-B', 'reply-B']);

    // No cross-contamination
    expect(t1.every(m => !String(m.content).includes('B'))).toBe(true);
    expect(t2.every(m => !String(m.content).includes('A'))).toBe(true);
  });

  it('serializes concurrent streams on the same thread (no interleaving)', async () => {
    scriptFetch({
      chat: [
        createSSEResponse(textResponseFrames({
          content: 'first',
          finishReason: 'stop',
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        })),
        createSSEResponse(textResponseFrames({
          content: 'second',
          finishReason: 'stop',
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        })),
      ],
    });

    handle = await createTempAgent({ memory: { enabled: false }, knowledge: { enabled: false } });

    // Kick off two concurrent streams on the same thread
    const [events1, events2] = await Promise.all([
      consumeStream(handle.agent.stream('a', { threadId: 'same' })),
      consumeStream(handle.agent.stream('b', { threadId: 'same' })),
    ]);

    // Both streams completed
    expect(events1[events1.length - 1]!.type).toBe('agent_end');
    expect(events2[events2.length - 1]!.type).toBe('agent_end');

    // History preserves causal order: user-a precedes user-b after serialization
    const history = handle.agent.getHistory('same');
    const userMsgs = history.filter(m => m.role === 'user').map(m => m.content);
    expect(userMsgs).toHaveLength(2);
    expect(userMsgs).toContain('a');
    expect(userMsgs).toContain('b');
    expect(history).toHaveLength(4); // 2× (user + assistant)
  });

  it('rejects invalid threadId at the public stream() boundary', async () => {
    handle = await createTempAgent({ memory: { enabled: false }, knowledge: { enabled: false } });

    await expect(async () => {
      for await (const _ of handle.agent.stream('x', { threadId: '../../../etc' })) { /* no-op */ }
    }).rejects.toThrow(/invalid threadid/i);
  });
});

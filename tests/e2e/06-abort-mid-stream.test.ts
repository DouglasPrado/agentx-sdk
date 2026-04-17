import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  scriptFetch,
  createTempAgent,
  type TempAgentHandle,
} from './helpers.js';
import type { AgentEvent } from '../../src/contracts/entities/agent-event.js';

/**
 * Exercises the abort path: a caller cancels the stream mid-flight; the
 * pipeline must stop promptly (not wait for any timeout) and release the
 * underlying SSE reader. Validates the bug fix that wires signal → reader.cancel().
 */
describe('E2E 06 — abort mid-stream', () => {
  let handle: TempAgentHandle;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (handle) await handle.cleanup();
  });

  it('cancels the SSE reader when the caller aborts mid-stream', async () => {
    const cancelCalls: number[] = [];
    let releasedLock = false;

    // A fake ReadableStream reader that hangs on read() until cancelled.
    // After cancel(), all pending reads must reject — mirrors real WHATWG
    // ReadableStream semantics. Our mock exposes a rejecter tied to cancel.
    let rejectRead: ((e: Error) => void) | null = null;
    const hangingReader = {
      read: () => new Promise<never>((_, reject) => { rejectRead = reject; }),
      cancel: vi.fn().mockImplementation(async () => {
        cancelCalls.push(Date.now());
        rejectRead?.(new Error('stream cancelled'));
      }),
      releaseLock: vi.fn().mockImplementation(() => { releasedLock = true; }),
      closed: Promise.resolve(undefined),
    };

    const hangingBody = { getReader: () => hangingReader } as unknown as ReadableStream<Uint8Array>;
    const hangingResponse = new Response(null, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    Object.defineProperty(hangingResponse, 'body', { value: hangingBody });

    scriptFetch({ chat: [hangingResponse] });

    handle = await createTempAgent({ memory: { enabled: false }, knowledge: { enabled: false } });

    const controller = new AbortController();
    const events: AgentEvent[] = [];

    const consume = (async () => {
      try {
        for await (const event of handle.agent.stream('hi', { signal: controller.signal })) {
          events.push(event);
        }
      } catch { /* abort may surface as a throw */ }
    })();

    // Let the stream start, then abort.
    await new Promise(r => setTimeout(r, 30));
    const abortAt = Date.now();
    controller.abort();

    // Must settle quickly (well under the 120s default fetch timeout).
    await Promise.race([
      consume,
      new Promise((_, reject) => setTimeout(() => reject(new Error('consume hung')), 2000)),
    ]);

    const settledAt = Date.now();
    expect(settledAt - abortAt).toBeLessThan(1000);

    // Reader was cancelled and lock released — no connection leak.
    expect(hangingReader.cancel).toHaveBeenCalled();
    expect(releasedLock).toBe(true);

    // At least agent_start was emitted before cancellation
    expect(events.some(e => e.type === 'agent_start')).toBe(true);
  });
});

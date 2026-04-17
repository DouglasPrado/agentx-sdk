import { describe, it, expect, afterEach, vi } from 'vitest';
import type { AgentEvent, AgentEndEvent, TextDeltaEvent } from '../../src/contracts/entities/agent-event.js';
import {
  createSSEResponse,
  scriptFetch,
  consumeStream,
  textResponseFrames,
  createTempAgent,
  type TempAgentHandle,
} from './helpers.js';

describe('E2E 01 — basic chat flow', () => {
  let handle: TempAgentHandle;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (handle) await handle.cleanup();
  });

  it('streams a full response and persists the turn', async () => {
    const scripted = scriptFetch({
      chat: [
        createSSEResponse(textResponseFrames({
          content: 'Olá, mundo!',
          finishReason: 'stop',
          usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
        })),
      ],
    });

    handle = await createTempAgent({ memory: { enabled: false }, knowledge: { enabled: false } });
    const events: AgentEvent[] = await consumeStream(handle.agent.stream('Olá'));

    // --- Event sequence ---
    expect(events[0]!.type).toBe('agent_start');
    expect(events[events.length - 1]!.type).toBe('agent_end');

    const textDeltas = events.filter((e): e is TextDeltaEvent => e.type === 'text_delta');
    expect(textDeltas.length).toBeGreaterThan(0);
    expect(textDeltas.map(e => e.content).join('')).toContain('Olá, mundo!');

    // --- Usage + duration ---
    const end = events[events.length - 1] as AgentEndEvent;
    expect(end.reason).toBe('stop');
    expect(end.usage.totalTokens).toBe(12);
    expect(end.duration).toBeGreaterThanOrEqual(0);

    // --- Persistence order (ORDER BY created_at ASC) ---
    const history = handle.agent.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0]!.role).toBe('user');
    expect(history[1]!.role).toBe('assistant');
    expect(history[0]!.createdAt).toBeLessThan(history[1]!.createdAt);

    // --- Request shape sanity ---
    expect(scripted.chatRequests).toHaveLength(1);
    const req = scripted.chatRequests[0]!;
    expect(req.stream).toBe(true);
    expect(Array.isArray(req.messages)).toBe(true);
  });

  it('emits agent_end with reason=stop even when usage is missing from SSE', async () => {
    scriptFetch({
      chat: [
        createSSEResponse(textResponseFrames({ content: 'hi', finishReason: 'stop' })),
      ],
    });

    handle = await createTempAgent({ memory: { enabled: false }, knowledge: { enabled: false } });
    const events = await consumeStream(handle.agent.stream('hi'));

    const end = events[events.length - 1] as AgentEndEvent;
    expect(end.type).toBe('agent_end');
    expect(end.reason).toBe('stop');
    // Missing usage from LLM must not crash — accumulator tolerates zero
    expect(end.usage.totalTokens).toBe(0);
  });
});

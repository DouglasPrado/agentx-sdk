import { describe, it, expect, afterEach, vi } from 'vitest';
import { z } from 'zod';
import type {
  AgentEvent,
  ToolCallStartEvent,
  ToolCallEndEvent,
} from '../../src/contracts/entities/agent-event.js';
import {
  createSSEResponse,
  scriptFetch,
  consumeStream,
  textResponseFrames,
  toolCallFrames,
  createTempAgent,
  type TempAgentHandle,
} from './helpers.js';

describe('E2E 02 — tool loop (react cycle)', () => {
  let handle: TempAgentHandle;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (handle) await handle.cleanup();
  });

  it('runs tool_call → tool_call_end → text_delta in a single stream() call', async () => {
    const calcFn = vi.fn(async (args: unknown) => {
      const { a, b } = args as { a: number; b: number };
      return `${a + b}`;
    });

    scriptFetch({
      chat: [
        // Turn 1: LLM asks to invoke `calc`
        createSSEResponse(toolCallFrames({
          toolCallId: 'call_1',
          name: 'calc',
          arguments: JSON.stringify({ a: 2, b: 3 }),
          usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
        })),
        // Turn 2: LLM sees the result and replies
        createSSEResponse(textResponseFrames({
          content: 'Result is 5.',
          finishReason: 'stop',
          usage: { prompt_tokens: 30, completion_tokens: 4, total_tokens: 34 },
        })),
      ],
    });

    handle = await createTempAgent({ memory: { enabled: false }, knowledge: { enabled: false } });
    handle.agent.addTool({
      name: 'calc',
      description: 'Sum two numbers',
      parameters: z.object({ a: z.number(), b: z.number() }),
      execute: calcFn,
    });

    const events: AgentEvent[] = await consumeStream(handle.agent.stream('2 + 3?'));

    // --- Tool was actually invoked with parsed args ---
    expect(calcFn).toHaveBeenCalledOnce();
    const firstCall = calcFn.mock.calls[0]!;
    expect(firstCall[0]).toEqual({ a: 2, b: 3 });

    // --- Tool events come in the expected order ---
    const toolStartIdx = events.findIndex(e => e.type === 'tool_call_start');
    const toolEndIdx = events.findIndex(e => e.type === 'tool_call_end');
    expect(toolStartIdx).toBeGreaterThanOrEqual(0);
    expect(toolEndIdx).toBeGreaterThan(toolStartIdx);

    const start = events[toolStartIdx] as ToolCallStartEvent;
    const end = events[toolEndIdx] as ToolCallEndEvent;
    expect(start.toolCall.id).toBe('call_1');
    expect(end.toolCallId).toBe(start.toolCall.id);
    expect(end.result.isError).toBeFalsy();
    expect(end.result.content).toBe('5');

    // --- Text comes after tool result ---
    const firstTextIdx = events.findIndex(e => e.type === 'text_delta');
    expect(firstTextIdx).toBeGreaterThan(toolEndIdx);

    // --- Persistence: [user, assistant(tool_calls), tool, assistant(text)] in createdAt order ---
    const history = handle.agent.getHistory();
    expect(history).toHaveLength(4);
    expect(history.map(m => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
    expect(history[1]!.toolCalls).toHaveLength(1);
    expect(history[1]!.toolCalls![0]!.id).toBe('call_1');
    expect(history[2]!.toolCallId).toBe('call_1');
    expect(history[2]!.content).toBe('5');
    expect(history[3]!.content).toContain('Result is 5.');

    // Strict ordering by createdAt
    for (let i = 1; i < history.length; i++) {
      expect(history[i]!.createdAt).toBeGreaterThanOrEqual(history[i - 1]!.createdAt);
    }

    // --- Cost accumulator sums both turns ---
    const usage = handle.agent.getUsage();
    expect(usage.totalTokens).toBe(25 + 34);
  });

  it('surfaces tool errors via tool_call_end.isError and keeps streaming (onToolError=continue)', async () => {
    scriptFetch({
      chat: [
        createSSEResponse(toolCallFrames({
          toolCallId: 'call_err',
          name: 'boom',
          arguments: '{}',
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        })),
        createSSEResponse(textResponseFrames({
          content: 'Recovered.',
          finishReason: 'stop',
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        })),
      ],
    });

    handle = await createTempAgent({ memory: { enabled: false }, knowledge: { enabled: false } });
    handle.agent.addTool({
      name: 'boom',
      description: 'Always fails',
      parameters: z.object({}),
      execute: async () => { throw new Error('kapow'); },
    });

    const events = await consumeStream(handle.agent.stream('do it'));

    const toolEnd = events.find((e): e is ToolCallEndEvent => e.type === 'tool_call_end');
    expect(toolEnd).toBeDefined();
    expect(toolEnd!.result.isError).toBe(true);
    expect(toolEnd!.result.content).toMatch(/kapow/);

    // Stream reached agent_end normally (continue mode)
    const end = events[events.length - 1]!;
    expect(end.type).toBe('agent_end');
  });
});

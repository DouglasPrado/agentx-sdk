import { describe, it, expect, vi } from 'vitest';
import type { TurnEndHook, TurnEndHookContext } from '../../../src/core/turn-end-hooks.js';
import { runTurnEndHooks } from '../../../src/core/turn-end-hooks.js';

function createContext(overrides: Partial<TurnEndHookContext> = {}): TurnEndHookContext {
  return {
    assistantText: 'Hello world',
    turnCount: 1,
    threadId: 'default',
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    ...overrides,
  };
}

describe('Turn-End Hooks', () => {
  it('should run all hooks in order', async () => {
    const order: string[] = [];
    const hooks: TurnEndHook[] = [
      { name: 'first', execute: async () => { order.push('first'); } },
      { name: 'second', execute: async () => { order.push('second'); } },
    ];

    await runTurnEndHooks(hooks, createContext());
    expect(order).toEqual(['first', 'second']);
  });

  it('should pass context to hooks', async () => {
    const receivedCtx: TurnEndHookContext[] = [];
    const hooks: TurnEndHook[] = [
      { name: 'spy', execute: async (ctx) => { receivedCtx.push(ctx); } },
    ];

    const ctx = createContext({ assistantText: 'test', turnCount: 3 });
    await runTurnEndHooks(hooks, ctx);

    expect(receivedCtx[0]!.assistantText).toBe('test');
    expect(receivedCtx[0]!.turnCount).toBe(3);
  });

  it('should not throw when a hook errors (fire-and-forget)', async () => {
    const hooks: TurnEndHook[] = [
      { name: 'broken', execute: async () => { throw new Error('boom'); } },
      { name: 'after', execute: vi.fn() },
    ];

    await expect(runTurnEndHooks(hooks, createContext())).resolves.not.toThrow();
    expect(hooks[1]!.execute).toHaveBeenCalled();
  });

  it('should run blocking hooks and collect errors', async () => {
    const hooks: TurnEndHook[] = [
      {
        name: 'blocker',
        blocking: true,
        execute: async () => ({ blockingError: 'Something failed' }),
      },
    ];

    const result = await runTurnEndHooks(hooks, createContext());
    expect(result.blockingErrors).toContain('Something failed');
  });

  it('should support preventContinuation from blocking hooks', async () => {
    const hooks: TurnEndHook[] = [
      {
        name: 'stopper',
        blocking: true,
        execute: async () => ({ preventContinuation: true }),
      },
    ];

    const result = await runTurnEndHooks(hooks, createContext());
    expect(result.preventContinuation).toBe(true);
  });

  it('should run fire-and-forget hooks without blocking result', async () => {
    let resolved = false;
    const hooks: TurnEndHook[] = [
      {
        name: 'slow',
        // blocking defaults to false (fire-and-forget)
        execute: async () => {
          await new Promise(r => setTimeout(r, 10));
          resolved = true;
        },
      },
    ];

    const result = await runTurnEndHooks(hooks, createContext());
    // Fire-and-forget hooks still run (we await them), but errors don't propagate
    expect(result.blockingErrors).toEqual([]);
    expect(resolved).toBe(true);
  });

  it('should handle empty hooks list', async () => {
    const result = await runTurnEndHooks([], createContext());
    expect(result.blockingErrors).toEqual([]);
    expect(result.preventContinuation).toBe(false);
  });

  it('should merge results from multiple blocking hooks', async () => {
    const hooks: TurnEndHook[] = [
      {
        name: 'blocker-1',
        blocking: true,
        execute: async () => ({ blockingError: 'Error 1' }),
      },
      {
        name: 'blocker-2',
        blocking: true,
        execute: async () => ({ blockingError: 'Error 2', preventContinuation: true }),
      },
    ];

    const result = await runTurnEndHooks(hooks, createContext());
    expect(result.blockingErrors).toEqual(['Error 1', 'Error 2']);
    expect(result.preventContinuation).toBe(true);
  });
});

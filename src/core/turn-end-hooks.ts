/**
 * Turn-end hooks — run after each completed assistant turn.
 *
 * Ported from old_src/query/stopHooks.ts pattern. In old_src, turn-end
 * is where "invisible intelligence" lives: memory extraction, session
 * summary, prompt suggestions, and custom hooks all fire here.
 *
 * Two modes:
 * - Fire-and-forget (blocking: false, default) — errors swallowed, never blocks
 * - Blocking (blocking: true) — can return errors and prevent continuation
 */

import type { TokenUsage } from '../contracts/entities/token-usage.js';

export interface TurnEndHookContext {
  assistantText: string;
  turnCount: number;
  threadId: string;
  usage: TokenUsage;
}

export interface TurnEndHookResult {
  blockingError?: string;
  preventContinuation?: boolean;
}

export interface TurnEndHook {
  name: string;
  /** If true, hook can return blocking errors and prevent continuation. Default: false. */
  blocking?: boolean;
  execute(context: TurnEndHookContext): Promise<TurnEndHookResult | void>;
}

export interface TurnEndHooksResult {
  blockingErrors: string[];
  preventContinuation: boolean;
}

/**
 * Run all turn-end hooks in order.
 * Fire-and-forget hooks (blocking: false) run but errors are swallowed.
 * Blocking hooks can return errors and prevent continuation.
 */
export async function runTurnEndHooks(
  hooks: TurnEndHook[],
  context: TurnEndHookContext,
): Promise<TurnEndHooksResult> {
  const blockingErrors: string[] = [];
  let preventContinuation = false;

  for (const hook of hooks) {
    try {
      const result = await hook.execute(context);

      if (hook.blocking && result) {
        if (result.blockingError) blockingErrors.push(result.blockingError);
        if (result.preventContinuation) preventContinuation = true;
      }
    } catch {
      // Hooks should never break the pipeline
    }
  }

  return { blockingErrors, preventContinuation };
}

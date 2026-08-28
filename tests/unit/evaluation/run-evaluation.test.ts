import { describe, it, expect, vi } from 'vitest';
import { runEvaluation } from '../../../src/evaluation/run-evaluation.js';
import type { Evaluator } from '../../../src/evaluation/evaluator.js';
import type { Evaluation, EvaluationStore } from '../../../src/contracts/entities/evaluation.js';
import type { Logger } from '../../../src/utils/logger.js';

function makeEvaluation(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    traceId: 'trace-1',
    threadId: 'thread-1',
    turnIndex: 0,
    scores: [{ criterion: 'factuality', score: 8, reasoning: 'r' }],
    finalScore: 8,
    judgeModel: 'judge-x',
    judgeUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    durationMs: 100,
    createdAt: '2026-05-15T12:00:00.000Z',
    ...overrides,
  };
}

function makeLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;
}

function makeStore(): EvaluationStore {
  return {
    append: vi.fn(),
    listByThread: vi.fn().mockReturnValue([]),
    listByTrace: vi.fn().mockReturnValue([]),
    aggregateByCriterion: vi.fn().mockReturnValue({
      factuality: { avg: 0, n: 0 },
      coherence: { avg: 0, n: 0 },
      safety: { avg: 0, n: 0 },
      completeness: { avg: 0, n: 0 },
      helpfulness: { avg: 0, n: 0 },
    }),
  };
}

function makeEvaluator(impl: () => Promise<Evaluation | null>): Evaluator {
  return { evaluate: vi.fn(impl) } as unknown as Evaluator;
}

const baseDeps = {
  traceId: 't1',
  threadId: 'thread-1',
  turnIndex: 2,
  userInput: 'hi',
  assistantText: 'hello',
};

describe('runEvaluation', () => {
  it('returns null and skips persistence when evaluator samples out', async () => {
    const evaluator = makeEvaluator(async () => null);
    const store = makeStore();
    const logger = makeLogger();
    const result = await runEvaluation({ ...baseDeps, evaluator, store, logger });
    expect(result).toBeNull();
    expect(store.append).not.toHaveBeenCalled();
  });

  it('persists evaluation to store when evaluator returns a result', async () => {
    const e = makeEvaluation({ traceId: 't1', threadId: 'thread-1', turnIndex: 2 });
    const evaluator = makeEvaluator(async () => e);
    const store = makeStore();
    const logger = makeLogger();
    const result = await runEvaluation({ ...baseDeps, evaluator, store, logger });
    expect(result).toEqual(e);
    expect(store.append).toHaveBeenCalledWith(e);
  });

  it('logs info with finalScore and judgeModel on success', async () => {
    const e = makeEvaluation({ finalScore: 7.25, judgeModel: 'judge-y' });
    const evaluator = makeEvaluator(async () => e);
    const store = makeStore();
    const logger = makeLogger();
    await runEvaluation({ ...baseDeps, evaluator, store, logger });
    expect(logger.info).toHaveBeenCalled();
    const call = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[1]).toMatchObject({ finalScore: 7.25, judgeModel: 'judge-y' });
  });

  it('swallows evaluator errors fire-and-forget and logs debug', async () => {
    const evaluator = makeEvaluator(async () => {
      throw new Error('judge boom');
    });
    const store = makeStore();
    const logger = makeLogger();
    await expect(runEvaluation({ ...baseDeps, evaluator, store, logger })).resolves.toBeNull();
    expect(store.append).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('continues silently when store.append throws', async () => {
    const e = makeEvaluation();
    const evaluator = makeEvaluator(async () => e);
    const store = makeStore();
    (store.append as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('disk full');
    });
    const logger = makeLogger();
    await expect(runEvaluation({ ...baseDeps, evaluator, store, logger })).resolves.toBeNull();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('forwards traceId/threadId/turnIndex/userInput/assistantText to evaluator', async () => {
    const e = makeEvaluation();
    const evaluator = makeEvaluator(async () => e);
    const evalSpy = evaluator.evaluate as ReturnType<typeof vi.fn>;
    const store = makeStore();
    const logger = makeLogger();
    await runEvaluation({
      traceId: 'tx',
      threadId: 'thr',
      turnIndex: 7,
      userInput: 'q',
      assistantText: 'a',
      signal: new AbortController().signal,
      evaluator,
      store,
      logger,
    });
    const passed = evalSpy.mock.calls[0]![0];
    expect(passed).toMatchObject({
      traceId: 'tx',
      threadId: 'thr',
      turnIndex: 7,
      userInput: 'q',
      assistantText: 'a',
    });
    expect(passed.signal).toBeDefined();
  });
});

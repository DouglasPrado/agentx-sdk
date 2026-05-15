import type { Evaluator } from './evaluator.js';
import type { Evaluation, EvaluationStore } from '../contracts/entities/evaluation.js';
import type { Logger } from '../utils/logger.js';

export interface RunEvaluationDeps {
  traceId: string;
  threadId: string;
  turnIndex: number;
  userInput: string;
  assistantText: string;
  signal?: AbortSignal;
  evaluator: Evaluator;
  store: EvaluationStore;
  logger: Logger;
}

/**
 * Fire-and-forget evaluation runner. Calls the evaluator, persists the
 * result, and emits an info log. Any error (judge, parse, store) is logged
 * at debug level and swallowed so the caller is never destabilised by
 * an evaluation failure.
 */
export async function runEvaluation(deps: RunEvaluationDeps): Promise<Evaluation | null> {
  const {
    evaluator,
    store,
    logger,
    traceId,
    threadId,
    turnIndex,
    userInput,
    assistantText,
    signal,
  } = deps;
  let evaluation: Evaluation | null = null;
  try {
    evaluation = await evaluator.evaluate({
      traceId,
      threadId,
      turnIndex,
      userInput,
      assistantText,
      signal,
    });
  } catch (err) {
    logger.debug('evaluation failed', {
      traceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  if (!evaluation) return null;

  try {
    store.append(evaluation);
  } catch (err) {
    logger.debug('evaluation persistence failed', {
      traceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  logger.info('evaluation complete', {
    traceId,
    threadId,
    turnIndex,
    finalScore: evaluation.finalScore,
    judgeModel: evaluation.judgeModel,
    judgeUsage: evaluation.judgeUsage,
    durationMs: evaluation.durationMs,
  });

  return evaluation;
}

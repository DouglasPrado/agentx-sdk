import { z } from 'zod';
import type { TokenUsage } from './token-usage.js';

export const EVALUATION_CRITERIA = [
  'factuality',
  'coherence',
  'safety',
  'completeness',
  'helpfulness',
] as const;

export const EvaluationCriterionSchema = z.enum(EVALUATION_CRITERIA);
export type EvaluationCriterion = z.infer<typeof EvaluationCriterionSchema>;

export const EvaluationScoreSchema = z.object({
  criterion: EvaluationCriterionSchema,
  score: z.number().int().min(1).max(10),
  reasoning: z.string().min(1),
});
export type EvaluationScore = z.infer<typeof EvaluationScoreSchema>;

const TokenUsageSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
});

export const EvaluationSchema = z
  .object({
    traceId: z.string().min(1),
    threadId: z.string().min(1),
    turnIndex: z.number().int().min(0),
    scores: z.array(EvaluationScoreSchema).min(1),
    finalScore: z.number().min(1).max(10),
    judgeModel: z.string().min(1),
    judgeUsage: TokenUsageSchema,
    durationMs: z.number().int().min(0),
    createdAt: z.string().min(1),
  })
  .superRefine((val, ctx) => {
    const seen = new Set<EvaluationCriterion>();
    for (const s of val.scores) {
      if (seen.has(s.criterion)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate criterion: ${s.criterion}`,
          path: ['scores'],
        });
        return;
      }
      seen.add(s.criterion);
    }
  });
export type Evaluation = z.infer<typeof EvaluationSchema>;

export type ScoreAggregation = 'mean' | 'min';

export function aggregateScore(scores: EvaluationScore[], strategy: ScoreAggregation): number {
  if (scores.length === 0) {
    throw new Error('aggregateScore: scores must not be empty');
  }
  if (strategy === 'min') {
    return scores.reduce((acc, s) => (s.score < acc ? s.score : acc), scores[0]!.score);
  }
  const sum = scores.reduce((acc, s) => acc + s.score, 0);
  const mean = sum / scores.length;
  return Math.round(mean * 100) / 100;
}

export interface EvaluationAggregate {
  avg: number;
  n: number;
}

export interface EvaluationStore {
  append(evaluation: Evaluation): void;
  listByThread(threadId: string, limit?: number): Evaluation[];
  listByTrace(traceId: string): Evaluation[];
  aggregateByCriterion(sinceIso: string): Record<EvaluationCriterion, EvaluationAggregate>;
}

export type EvaluationJudgeUsage = TokenUsage;

import { describe, it, expect } from 'vitest';
import {
  EvaluationCriterionSchema,
  EvaluationScoreSchema,
  EvaluationSchema,
  aggregateScore,
  EVALUATION_CRITERIA,
} from '../../../src/contracts/entities/evaluation.js';
import type {
  EvaluationCriterion,
  EvaluationScore,
  Evaluation,
} from '../../../src/contracts/entities/evaluation.js';

describe('evaluation contracts', () => {
  describe('EVALUATION_CRITERIA', () => {
    it('should contain factuality, coherence, safety, completeness, helpfulness', () => {
      expect(EVALUATION_CRITERIA).toEqual([
        'factuality',
        'coherence',
        'safety',
        'completeness',
        'helpfulness',
      ]);
    });
  });

  describe('EvaluationCriterionSchema', () => {
    it('should accept all known criteria', () => {
      for (const c of EVALUATION_CRITERIA) {
        expect(EvaluationCriterionSchema.safeParse(c).success).toBe(true);
      }
    });

    it('should reject unknown criterion', () => {
      expect(EvaluationCriterionSchema.safeParse('foo').success).toBe(false);
    });
  });

  describe('EvaluationScoreSchema', () => {
    it('should accept valid integer score between 1 and 10', () => {
      const score: EvaluationScore = {
        criterion: 'factuality',
        score: 7,
        reasoning: 'response is factually accurate with verified claims',
      };
      expect(EvaluationScoreSchema.safeParse(score).success).toBe(true);
    });

    it('should reject score above 10', () => {
      const result = EvaluationScoreSchema.safeParse({
        criterion: 'factuality',
        score: 11,
        reasoning: 'r',
      });
      expect(result.success).toBe(false);
    });

    it('should reject score below 1', () => {
      const result = EvaluationScoreSchema.safeParse({
        criterion: 'factuality',
        score: 0,
        reasoning: 'r',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer score', () => {
      const result = EvaluationScoreSchema.safeParse({
        criterion: 'factuality',
        score: 5.5,
        reasoning: 'r',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty reasoning', () => {
      const result = EvaluationScoreSchema.safeParse({
        criterion: 'factuality',
        score: 5,
        reasoning: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('EvaluationSchema', () => {
    const baseEval: Evaluation = {
      traceId: 'trace-1',
      threadId: 'thread-1',
      turnIndex: 0,
      scores: [
        { criterion: 'factuality', score: 8, reasoning: 'r1' },
        { criterion: 'coherence', score: 9, reasoning: 'r2' },
      ],
      finalScore: 8.5,
      judgeModel: 'anthropic/claude-haiku-4-5',
      judgeUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      durationMs: 1234,
      createdAt: '2026-05-15T12:00:00.000Z',
    };

    it('should accept a valid evaluation', () => {
      expect(EvaluationSchema.safeParse(baseEval).success).toBe(true);
    });

    it('should reject empty scores array', () => {
      const result = EvaluationSchema.safeParse({ ...baseEval, scores: [] });
      expect(result.success).toBe(false);
    });

    it('should reject duplicate criteria in scores', () => {
      const result = EvaluationSchema.safeParse({
        ...baseEval,
        scores: [
          { criterion: 'factuality', score: 8, reasoning: 'r1' },
          { criterion: 'factuality', score: 5, reasoning: 'r2' },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should reject finalScore outside 1-10 range', () => {
      const result = EvaluationSchema.safeParse({ ...baseEval, finalScore: 11 });
      expect(result.success).toBe(false);
    });

    it('should reject negative durationMs', () => {
      const result = EvaluationSchema.safeParse({ ...baseEval, durationMs: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('aggregateScore', () => {
    const scores: EvaluationScore[] = [
      { criterion: 'factuality', score: 8, reasoning: 'r' },
      { criterion: 'coherence', score: 6, reasoning: 'r' },
      { criterion: 'safety', score: 10, reasoning: 'r' },
    ];

    it('should compute arithmetic mean', () => {
      expect(aggregateScore(scores, 'mean')).toBeCloseTo(8, 5);
    });

    it('should compute minimum', () => {
      expect(aggregateScore(scores, 'min')).toBe(6);
    });

    it('should throw on empty scores', () => {
      expect(() => aggregateScore([], 'mean')).toThrow();
      expect(() => aggregateScore([], 'min')).toThrow();
    });

    it('should round mean to 2 decimal places', () => {
      const s: EvaluationScore[] = [
        { criterion: 'factuality', score: 8, reasoning: 'r' },
        { criterion: 'coherence', score: 7, reasoning: 'r' },
        { criterion: 'safety', score: 7, reasoning: 'r' },
      ];
      expect(aggregateScore(s, 'mean')).toBe(7.33);
    });
  });

  describe('type exports', () => {
    it('should expose EvaluationCriterion as union of literal strings', () => {
      const c: EvaluationCriterion = 'factuality';
      expect(EVALUATION_CRITERIA).toContain(c);
    });
  });
});

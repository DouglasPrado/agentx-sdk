import { describe, it, expect } from 'vitest';
import { AgentConfigSchema } from '../../../src/config/config.js';

describe('EvaluatorConfig schema', () => {
  const base = { apiKey: 'k' };

  it('accepts config without evaluator (default disabled)', () => {
    const result = AgentConfigSchema.safeParse(base);
    expect(result.success).toBe(true);
    expect(result.success && result.data.evaluator).toBeUndefined();
  });

  it('accepts enabled evaluator with defaults', () => {
    const result = AgentConfigSchema.safeParse({
      ...base,
      evaluator: { enabled: true },
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.evaluator) {
      expect(result.data.evaluator.enabled).toBe(true);
      expect(result.data.evaluator.judgeModel).toBe('anthropic/claude-haiku-4-5');
      expect(result.data.evaluator.sampleRate).toBe(1.0);
      expect(result.data.evaluator.scoreAggregation).toBe('mean');
      expect(result.data.evaluator.timeout).toBeGreaterThan(0);
      expect(result.data.evaluator.criteria).toEqual([
        'factuality',
        'coherence',
        'safety',
        'completeness',
      ]);
    }
  });

  it('rejects sampleRate above 1', () => {
    const result = AgentConfigSchema.safeParse({
      ...base,
      evaluator: { enabled: true, sampleRate: 1.5 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects sampleRate below 0', () => {
    const result = AgentConfigSchema.safeParse({
      ...base,
      evaluator: { enabled: true, sampleRate: -0.1 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty criteria array', () => {
    const result = AgentConfigSchema.safeParse({
      ...base,
      evaluator: { enabled: true, criteria: [] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown criterion', () => {
    const result = AgentConfigSchema.safeParse({
      ...base,
      evaluator: { enabled: true, criteria: ['factuality', 'bogus'] },
    });
    expect(result.success).toBe(false);
  });

  it('accepts custom judgeModel and overrides aggregation', () => {
    const result = AgentConfigSchema.safeParse({
      ...base,
      evaluator: {
        enabled: true,
        judgeModel: 'anthropic/claude-sonnet-4',
        scoreAggregation: 'min',
        sampleRate: 0.25,
      },
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.evaluator) {
      expect(result.data.evaluator.judgeModel).toBe('anthropic/claude-sonnet-4');
      expect(result.data.evaluator.scoreAggregation).toBe('min');
      expect(result.data.evaluator.sampleRate).toBe(0.25);
    }
  });

  it('rejects non-positive timeout', () => {
    const result = AgentConfigSchema.safeParse({
      ...base,
      evaluator: { enabled: true, timeout: 0 },
    });
    expect(result.success).toBe(false);
  });
});

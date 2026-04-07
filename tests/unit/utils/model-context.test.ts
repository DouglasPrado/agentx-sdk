import { describe, it, expect } from 'vitest';
import { getModelContextWindow } from '../../../src/utils/model-context.js';

describe('getModelContextWindow', () => {
  it('should return known context window for Claude models', () => {
    expect(getModelContextWindow('anthropic/claude-sonnet-4-20250514')).toBe(200_000);
    expect(getModelContextWindow('anthropic/claude-opus-4-20250514')).toBe(200_000);
    expect(getModelContextWindow('anthropic/claude-haiku-4-5-20251001')).toBe(200_000);
  });

  it('should return known context window for GPT models', () => {
    expect(getModelContextWindow('openai/gpt-4o')).toBe(128_000);
    expect(getModelContextWindow('openai/gpt-4-turbo')).toBe(128_000);
  });

  it('should return default for unknown models', () => {
    expect(getModelContextWindow('unknown/model-xyz')).toBe(128_000);
  });

  it('should match partial model names', () => {
    expect(getModelContextWindow('anthropic/claude-sonnet-4-20250514:beta')).toBe(200_000);
  });

  it('should accept override', () => {
    expect(getModelContextWindow('unknown/model', 64_000)).toBe(64_000);
  });
});

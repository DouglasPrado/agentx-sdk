import { describe, it, expect } from 'vitest';
import {
  classifyAPIError,
  InsufficientCreditsError,
  OverloadedError,
  PromptTooLongError,
} from '../../../src/llm/errors.js';

describe('classifyAPIError', () => {
  it('classifies a real 402 LLM error as InsufficientCreditsError', () => {
    const err = new Error('LLM API error 402: insufficient credits');
    expect(classifyAPIError(err)).toBeInstanceOf(InsufficientCreditsError);
  });

  it('classifies a real 413 LLM error as PromptTooLongError', () => {
    const err = new Error('LLM API error 413: prompt too long');
    expect(classifyAPIError(err)).toBeInstanceOf(PromptTooLongError);
  });

  it('classifies a real 529 LLM error as OverloadedError', () => {
    const err = new Error('LLM API error 529: model overloaded');
    expect(classifyAPIError(err)).toBeInstanceOf(OverloadedError);
  });

  it('does not misclassify error messages containing unrelated digits matching status codes', () => {
    const err = new Error('Error ID: 402-alpha-validation failed');
    const classified = classifyAPIError(err);
    expect(classified).not.toBeInstanceOf(InsufficientCreditsError);
  });

  it('does not misclassify request IDs containing status-like digits', () => {
    const err = new Error('Request id req_4139283 failed for unknown reason');
    const classified = classifyAPIError(err);
    expect(classified).not.toBeInstanceOf(PromptTooLongError);
  });

  it('returns the original error when message has no recognizable status', () => {
    const err = new Error('ECONNRESET');
    expect(classifyAPIError(err)).toBe(err);
  });
});

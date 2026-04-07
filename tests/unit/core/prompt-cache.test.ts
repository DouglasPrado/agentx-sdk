import { describe, it, expect } from 'vitest';
import { PromptSectionCache } from '../../../src/core/prompt-cache.js';

describe('PromptSectionCache', () => {
  it('should cache builder result on first call', () => {
    const cache = new PromptSectionCache();
    let callCount = 0;
    const builder = () => { callCount++; return 'built content'; };

    const first = cache.getOrBuild('test', builder);
    const second = cache.getOrBuild('test', builder);

    expect(first.content).toBe('built content');
    expect(second.content).toBe('built content');
    expect(callCount).toBe(1); // builder called only once
  });

  it('should return token count', () => {
    const cache = new PromptSectionCache();
    const result = cache.getOrBuild('test', () => 'hello world');
    expect(result.tokens).toBeGreaterThan(0);
  });

  it('should rebuild after invalidation', () => {
    const cache = new PromptSectionCache();
    let version = 1;
    const builder = () => `v${version}`;

    cache.getOrBuild('test', builder);
    version = 2;
    cache.invalidate('test');

    const result = cache.getOrBuild('test', builder);
    expect(result.content).toBe('v2');
  });

  it('should clear all entries', () => {
    const cache = new PromptSectionCache();
    cache.getOrBuild('a', () => 'aaa');
    cache.getOrBuild('b', () => 'bbb');
    cache.clear();

    let rebuilt = false;
    cache.getOrBuild('a', () => { rebuilt = true; return 'new'; });
    expect(rebuilt).toBe(true);
  });

  it('should handle different keys independently', () => {
    const cache = new PromptSectionCache();
    const a = cache.getOrBuild('a', () => 'alpha');
    const b = cache.getOrBuild('b', () => 'beta');

    expect(a.content).toBe('alpha');
    expect(b.content).toBe('beta');
  });
});

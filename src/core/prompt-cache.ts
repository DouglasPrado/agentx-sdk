/**
 * Prompt section cache — avoids rebuilding identical sections every turn.
 *
 * Sections like memory instructions, tool listing, and environment info
 * don't change between turns. Caching them avoids redundant computation
 * and improves prompt cache hit rates on the API side.
 */

import { estimateTokens } from '../utils/token-counter.js';

interface CachedSection {
  content: string;
  tokens: number;
}

export class PromptSectionCache {
  private readonly cache = new Map<string, CachedSection>();

  /**
   * Get a cached section or build it.
   * Builder is only called on cache miss.
   */
  getOrBuild(key: string, builder: () => string): CachedSection {
    const cached = this.cache.get(key);
    if (cached) return cached;

    const content = builder();
    const tokens = estimateTokens(content);
    const entry = { content, tokens };
    this.cache.set(key, entry);
    return entry;
  }

  /** Invalidate a specific section (forces rebuild on next getOrBuild). */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /** Clear all cached sections. */
  clear(): void {
    this.cache.clear();
  }
}

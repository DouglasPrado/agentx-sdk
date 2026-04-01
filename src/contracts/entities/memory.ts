import type { MemoryScope, MemoryCategory, MemorySource, MemoryState } from '../enums/index.js';

/** A persistent fact extracted from conversations */
export interface Memory {
  id: string;
  content: string;
  scope: MemoryScope;
  category: MemoryCategory;
  confidence: number;
  accessCount: number;
  source: MemorySource;
  threadId?: string;
  embedding?: Float32Array;
  createdAt: number;
  lastAccessedAt: number;
  state: MemoryState;
}

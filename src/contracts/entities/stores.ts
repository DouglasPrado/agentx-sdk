import type { Memory } from './memory.js';
import type { ChatMessage } from './chat-message.js';
import type { KnowledgeChunk, RetrievedKnowledge } from './knowledge.js';

/** Pluggable interface for memory persistence */
export interface MemoryStore {
  save(memory: Memory): Memory;
  search(query: string, options?: MemorySearchOptions): Memory[];
  findById(id: string): Memory | null;
  incrementAccess(id: string): void;
  deleteLowConfidence(minConfidence: number): number;
  listByScope(scope: string, threadId?: string): Memory[];
}

export interface MemorySearchOptions {
  limit?: number;
  scope?: string;
  threadId?: string;
  minConfidence?: number;
  embedding?: Float32Array;
}

/** Pluggable interface for vector storage (knowledge/RAG) */
export interface VectorStore {
  upsert(chunk: KnowledgeChunk): void;
  search(queryEmbedding: Float32Array, topK: number): RetrievedKnowledge[];
  delete(id: string): void;
}

/** Pluggable interface for conversation history persistence */
export interface ConversationStore {
  appendMessage(message: ChatMessage, threadId: string): void;
  listThread(threadId: string): ChatMessage[];
  listPinned(threadId: string): ChatMessage[];
  clearThread(threadId: string): void;
}

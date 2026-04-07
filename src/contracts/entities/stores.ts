import type { ChatMessage } from './chat-message.js';
import type { KnowledgeChunk, RetrievedKnowledge } from './knowledge.js';

/** Pluggable interface for vector storage (knowledge/RAG) */
export interface VectorStore {
  upsert(chunk: KnowledgeChunk): void;
  search(queryEmbedding: Float32Array, topK: number): RetrievedKnowledge[];
  delete(id: string): void;
  listAll(): KnowledgeChunk[];
  deleteBySource(sourceId: string): void;
}

/** Pluggable interface for conversation history persistence */
export interface ConversationStore {
  appendMessage(message: ChatMessage, threadId: string): void;
  listThread(threadId: string): ChatMessage[];
  listPinned(threadId: string): ChatMessage[];
  clearThread(threadId: string): void;
}

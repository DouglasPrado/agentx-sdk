/** A document to be ingested for RAG */
export interface KnowledgeDocument {
  content: string;
  metadata?: Record<string, unknown>;
}

/** A chunk of a document with its embedding */
export interface KnowledgeChunk {
  id: string;
  content: string;
  embedding: Float32Array;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

/** A knowledge chunk retrieved by similarity search */
export interface RetrievedKnowledge {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

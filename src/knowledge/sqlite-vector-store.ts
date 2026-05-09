import type { VectorStore } from '../contracts/entities/stores.js';
import type { KnowledgeChunk, RetrievedKnowledge } from '../contracts/entities/knowledge.js';
import type { SQLiteDatabase } from '../storage/sqlite-database.js';
import { cosineSimilarity } from '../utils/vector-math.js';

/** Maximum rows scanned per search call to bound memory usage. */
const MAX_SCAN = 10_000;

/** Maximum rows returned by listAll() to prevent OOM on large knowledge bases. */
const MAX_LIST_ALL = 10_000;

/**
 * SQLite implementation of VectorStore with brute-force cosine similarity.
 */
export class SQLiteVectorStore implements VectorStore {
  private readonly database: SQLiteDatabase;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  upsert(chunk: KnowledgeChunk): void {
    this.database.db
      .prepare(
        `
      INSERT OR REPLACE INTO vectors (id, content, embedding, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
      )
      .run(
        chunk.id,
        chunk.content,
        Buffer.from(chunk.embedding.buffer),
        chunk.metadata ? JSON.stringify(chunk.metadata) : null,
        chunk.createdAt,
      );
  }

  /** Atomic batch insert: rolls back all rows if any single insert fails. */
  upsertMany(chunks: KnowledgeChunk[]): void {
    if (chunks.length === 0) return;
    const stmt = this.database.db.prepare(`
      INSERT OR REPLACE INTO vectors (id, content, embedding, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const tx = this.database.db.transaction((rows: KnowledgeChunk[]) => {
      for (const c of rows) {
        stmt.run(
          c.id,
          c.content,
          Buffer.from(c.embedding.buffer),
          c.metadata ? JSON.stringify(c.metadata) : null,
          c.createdAt,
        );
      }
    });
    tx(chunks);
  }

  private bufferToFloat32(buf: Buffer): Float32Array {
    if (buf.byteLength % 4 !== 0) {
      throw new Error(
        `Invalid embedding blob: byteLength ${buf.byteLength} is not a multiple of 4`,
      );
    }
    return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  }

  search(queryEmbedding: Float32Array, topK: number): RetrievedKnowledge[] {
    const rows = this.database.db
      .prepare('SELECT * FROM vectors ORDER BY created_at DESC LIMIT ?')
      .all(MAX_SCAN) as VectorRow[];

    const scored = rows.map((row) => {
      const embedding = this.bufferToFloat32(row.embedding);
      return {
        id: row.id,
        content: row.content,
        score: cosineSimilarity(queryEmbedding, embedding),
        metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  delete(id: string): void {
    this.database.db.prepare('DELETE FROM vectors WHERE id = ?').run(id);
  }

  listAll(): KnowledgeChunk[] {
    const rows = this.database.db
      .prepare('SELECT * FROM vectors ORDER BY created_at ASC LIMIT ?')
      .all(MAX_LIST_ALL) as VectorRow[];
    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      embedding: this.bufferToFloat32(row.embedding),
      metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
      createdAt: row.created_at,
    }));
  }

  deleteBySource(sourceId: string): void {
    this.database.db
      .prepare("DELETE FROM vectors WHERE json_extract(metadata, '$.sourceId') = ?")
      .run(sourceId);
  }
}

interface VectorRow {
  id: string;
  content: string;
  embedding: Buffer;
  metadata: string | null;
  created_at: number;
}

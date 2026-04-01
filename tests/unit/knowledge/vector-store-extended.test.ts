import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteDatabase } from '../../../src/storage/sqlite-database.js';
import { SQLiteVectorStore } from '../../../src/knowledge/sqlite-vector-store.js';

describe('SQLiteVectorStore — extended methods', () => {
  let database: SQLiteDatabase;
  let store: SQLiteVectorStore;

  beforeEach(() => {
    database = new SQLiteDatabase(':memory:');
    database.initialize();
    store = new SQLiteVectorStore(database);
  });

  afterEach(() => {
    database.close();
  });

  it('listAll() should return all stored chunks', () => {
    store.upsert({ id: 'c1', content: 'chunk 1', embedding: new Float32Array([1, 0]), createdAt: 100 });
    store.upsert({ id: 'c2', content: 'chunk 2', embedding: new Float32Array([0, 1]), createdAt: 200 });

    const all = store.listAll();
    expect(all).toHaveLength(2);
    expect(all[0]!.id).toBe('c1');
    expect(all[0]!.embedding).toBeInstanceOf(Float32Array);
    expect(all[0]!.embedding.length).toBe(2);
  });

  it('listAll() should return empty for no data', () => {
    expect(store.listAll()).toHaveLength(0);
  });

  it('deleteBySource() should remove chunks by metadata sourceId', () => {
    store.upsert({ id: 'c1', content: 'a', embedding: new Float32Array([1]), metadata: { sourceId: 'doc-1' }, createdAt: 100 });
    store.upsert({ id: 'c2', content: 'b', embedding: new Float32Array([1]), metadata: { sourceId: 'doc-1' }, createdAt: 200 });
    store.upsert({ id: 'c3', content: 'c', embedding: new Float32Array([1]), metadata: { sourceId: 'doc-2' }, createdAt: 300 });

    store.deleteBySource('doc-1');

    const all = store.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe('c3');
  });

  it('deleteBySource() should be no-op for unknown source', () => {
    store.upsert({ id: 'c1', content: 'a', embedding: new Float32Array([1]), metadata: { sourceId: 'doc-1' }, createdAt: 100 });
    store.deleteBySource('nonexistent');
    expect(store.listAll()).toHaveLength(1);
  });
});

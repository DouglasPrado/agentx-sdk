import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeManager } from '../../../src/knowledge/knowledge-manager.js';
import type { VectorStore } from '../../../src/contracts/entities/stores.js';
import type { EmbeddingService } from '../../../src/knowledge/embedding-service.js';

function createMockStore(): VectorStore {
  return {
    upsert: vi.fn(),
    search: vi.fn(() => []),
    delete: vi.fn(),
    listAll: vi.fn(() => []),
    deleteBySource: vi.fn(),
  };
}

function createMockEmbeddingService(): EmbeddingService {
  return {
    embed: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3])),
    embedSingle: vi.fn(async () => new Float32Array([0.1, 0.2, 0.3])),
  } as unknown as EmbeddingService;
}

describe('KnowledgeManager', () => {
  let store: VectorStore;
  let embeddingService: EmbeddingService;
  let manager: KnowledgeManager;

  beforeEach(() => {
    store = createMockStore();
    embeddingService = createMockEmbeddingService();
    manager = new KnowledgeManager({ store, embeddingService, chunkSize: 50, chunkOverlap: 5 });
  });

  it('should ingest a document and persist chunks', async () => {
    const count = await manager.ingest({
      content: 'This is a test document with enough content to be chunked into pieces.',
    });
    expect(count).toBeGreaterThan(0);
    expect(store.upsert).toHaveBeenCalledTimes(count);
    expect(embeddingService.embed).toHaveBeenCalledOnce();
  });

  it('should return 0 for empty document', async () => {
    const count = await manager.ingest({ content: '' });
    expect(count).toBe(0);
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it('should pass metadata to chunks', async () => {
    await manager.ingest({ content: 'Short.', metadata: { source: 'readme' } });
    const chunk = vi.mocked(store.upsert).mock.calls[0]![0];
    expect(chunk.metadata).toMatchObject({ source: 'readme', chunkIndex: 0 });
  });

  it('should search and filter by minScore', async () => {
    vi.mocked(store.search).mockReturnValue([
      { id: '1', content: 'good', score: 0.9, metadata: {} },
      { id: '2', content: 'bad', score: 0.1, metadata: {} },
    ]);

    const results = await manager.search('query');
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('1');
  });

  it('should cache search results', async () => {
    vi.mocked(store.search).mockReturnValue([{ id: '1', content: 'test', score: 0.8 }]);

    await manager.search('query');
    await manager.search('query'); // should hit cache

    expect(embeddingService.embedSingle).toHaveBeenCalledOnce();
  });

  it('throws informative error when EmbeddingService returns fewer vectors than chunks (#174)', async () => {
    // Simulate buggy/truncated provider: only 1 embedding returned for multiple chunks
    vi.mocked(embeddingService.embed).mockResolvedValueOnce([[0.1, 0.2, 0.3]]);

    await expect(
      manager.ingest({
        content:
          'First chunk content here with enough text. Second chunk content here with enough text.',
      }),
    ).rejects.toThrow(/embeddingservice returned/i);
  });

  it('should invalidate search cache after ingest()', async () => {
    // First search — populates cache
    vi.mocked(store.search).mockReturnValue([]);
    await manager.search('query');
    expect(embeddingService.embedSingle).toHaveBeenCalledOnce();

    // Ingest a new document
    await manager.ingest({ content: 'New relevant content for the query.' });

    // Now store returns the newly ingested chunk
    vi.mocked(store.search).mockReturnValue([
      { id: 'new', content: 'New relevant content', score: 0.9, metadata: {} },
    ]);

    // Second search — cache must be cleared so store is consulted again
    const results = await manager.search('query');
    expect(embeddingService.embedSingle).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('new');
  });
});

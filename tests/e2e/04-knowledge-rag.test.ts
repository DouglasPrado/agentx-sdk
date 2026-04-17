import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createEmbeddingResponse,
  scriptFetch,
  createTempAgent,
  type TempAgentHandle,
} from './helpers.js';

describe('E2E 04 — knowledge RAG (ingest → search)', () => {
  let handle: TempAgentHandle;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (handle) await handle.cleanup();
  });

  it('ingests chunks atomically and returns them on semantic search', async () => {
    const docVec = [1, 0, 0, 0];
    const queryVec = [0.95, 0.05, 0, 0]; // cosine ~0.95 vs docVec

    const scripted = scriptFetch({
      embeddings: [
        // First call: batch embed of N chunks during ingest
        createEmbeddingResponse([docVec]),
        // Second call: single embed for the query
        createEmbeddingResponse([queryVec]),
      ],
    });

    handle = await createTempAgent({
      memory: { enabled: false },
      knowledge: { enabled: true, chunkSize: 2048, chunkOverlap: 0, topK: 5, minScore: 0.5 },
    });

    // --- Ingest ---
    await handle.agent.ingestKnowledge({
      id: 'doc-1',
      content: 'TypeScript is a strongly-typed superset of JavaScript.',
      metadata: { source: 'readme', sourceId: 'doc-1' },
    });

    // --- Search ---
    const results = await handle.agent.searchKnowledge('what is typescript');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.score).toBeGreaterThanOrEqual(0.5);
    expect(results[0]!.content).toContain('TypeScript');

    // Ingest triggers one embeddings call; search triggers a second
    expect(scripted.embeddingRequests).toHaveLength(2);
    // Ingest request has array input; search has single string
    expect(Array.isArray(scripted.embeddingRequests[0]!.input)).toBe(true);
  });

  it('filters out results below minScore (opposite-direction vectors are clamped to 0)', async () => {
    const docVec = [1, 0, 0, 0];
    const oppositeVec = [-1, 0, 0, 0]; // cosine = -1, clamped to 0 — below minScore

    scriptFetch({
      embeddings: [
        createEmbeddingResponse([docVec]),
        createEmbeddingResponse([oppositeVec]),
      ],
    });

    handle = await createTempAgent({
      memory: { enabled: false },
      knowledge: { enabled: true, chunkSize: 2048, chunkOverlap: 0, topK: 5, minScore: 0.3 },
    });

    await handle.agent.ingestKnowledge({
      id: 'doc-1',
      content: 'Some doc content.',
    });

    const results = await handle.agent.searchKnowledge('unrelated query');
    expect(results).toHaveLength(0);
  });
});

import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent } from '../../src/agent.js';
import {
  createEmbeddingResponse,
  createSSEResponse,
  scriptFetch,
  consumeStream,
  textResponseFrames,
} from './helpers.js';

/**
 * Two Agent instances sharing the same dbPath. Agent A writes, destroys.
 * Agent B opens the same file and reads. Verifies SQLite persistence contract
 * (schema idempotence, WAL checkpoint, history + vector store survival).
 */
describe('E2E 07 — persistence across Agent instances', () => {
  let tempDir: string;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it('Agent B reads conversation history written by Agent A via shared dbPath', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agentx-e2e-persist-'));
    const dbPath = join(tempDir, 'shared.db');
    const memoryDir = join(tempDir, 'memory') + '/';

    scriptFetch({
      chat: [
        createSSEResponse(textResponseFrames({
          content: 'from agent A',
          finishReason: 'stop',
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        })),
      ],
    });

    // --- Agent A: write ---
    const agentA = Agent.create({
      apiKey: 'test-key',
      baseUrl: 'https://api.test/v1',
      logLevel: 'silent',
      dbPath,
      memory: { enabled: false },
      knowledge: { enabled: true },
    });
    void memoryDir; // not used here, but kept to mirror the other E2Es
    await consumeStream(agentA.stream('persist-me', { threadId: 'shared-thread' }));
    await agentA.destroy();

    // --- Agent B: read ---
    const agentB = Agent.create({
      apiKey: 'test-key',
      baseUrl: 'https://api.test/v1',
      logLevel: 'silent',
      dbPath,
      memory: { enabled: false },
      knowledge: { enabled: true },
    });

    const history = agentB.getHistory('shared-thread');
    expect(history).toHaveLength(2);
    expect(history[0]!.role).toBe('user');
    expect(history[0]!.content).toBe('persist-me');
    expect(history[1]!.role).toBe('assistant');
    expect(history[1]!.content).toBe('from agent A');

    await agentB.destroy();
  });

  it('Agent B retrieves knowledge chunks ingested by Agent A', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agentx-e2e-persist-knowledge-'));
    const dbPath = join(tempDir, 'shared.db');

    const vec = [1, 0, 0, 0];
    scriptFetch({
      embeddings: [
        createEmbeddingResponse([vec]), // ingest
        createEmbeddingResponse([vec]), // search (agent B)
      ],
    });

    // --- Agent A: ingest ---
    const agentA = Agent.create({
      apiKey: 'test-key',
      baseUrl: 'https://api.test/v1',
      logLevel: 'silent',
      dbPath,
      memory: { enabled: false },
      knowledge: { enabled: true, chunkSize: 2048, chunkOverlap: 0, minScore: 0 },
    });
    await agentA.ingestKnowledge({ id: 'd1', content: 'Hello durable world.' });
    await agentA.destroy();

    // --- Agent B: search ---
    const agentB = Agent.create({
      apiKey: 'test-key',
      baseUrl: 'https://api.test/v1',
      logLevel: 'silent',
      dbPath,
      memory: { enabled: false },
      knowledge: { enabled: true, chunkSize: 2048, chunkOverlap: 0, minScore: 0 },
    });
    const results = await agentB.searchKnowledge('durable');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.content).toContain('durable');

    await agentB.destroy();
  });
});

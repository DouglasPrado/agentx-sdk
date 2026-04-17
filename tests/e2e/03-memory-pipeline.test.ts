import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createSSEResponse,
  scriptFetch,
  textResponseFrames,
  createTempAgent,
  type TempAgentHandle,
} from './helpers.js';

/**
 * Exercises the memory round-trip via the public API (not via the extraction
 * fork — that would require an LLM-driven sub-agent, which is out of scope for
 * a deterministic E2E). The key thing we verify here is the pipeline:
 *   remember() → file on disk → recall() → relevant context on next turn.
 */
describe('E2E 03 — memory pipeline (save → recall → inject)', () => {
  let handle: TempAgentHandle;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (handle) await handle.cleanup();
  });

  it('persists memory to disk under the thread dir and recalls it', async () => {
    // Embedding calls happen for skill semantic matching; provide zero vectors.
    // Chat calls: (1) memory relevance selection JSON, (2) final answer.
    scriptFetch({
      chat: [
        // First chat hit = memory relevance LLM (non-streaming, returns JSON)
        new Response(JSON.stringify({
          choices: [{
            message: { content: JSON.stringify({ selected_memories: ['user-name-is-douglas.md'] }) },
            finish_reason: 'stop',
          }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ],
    });

    handle = await createTempAgent({
      // Disable extraction — E2E focuses on the save/recall path, not the
      // LLM-driven fork extractor (covered by unit tests).
      memory: { enabled: true, extractionEnabled: false, samplingRate: 0, extractionInterval: 9999 },
      knowledge: { enabled: false },
    });

    // --- Save a memory via the public API, scoped to a thread ---
    const filename = await handle.agent.remember('user name is Douglas', 'user', 'thread-42');
    expect(filename).toMatch(/\.md$/);

    // File exists under the thread subdir
    const threadDir = join(handle.memoryDir, 'threads', 'thread-42');
    const files = await readdir(threadDir);
    expect(files).toContain(filename);
    expect(files).toContain('MEMORY.md');

    const content = await readFile(join(threadDir, filename), 'utf-8');
    expect(content).toContain('type: user');
    expect(content).toContain('user name is Douglas');

    // MEMORY.md index references the file
    const index = await readFile(join(threadDir, 'MEMORY.md'), 'utf-8');
    expect(index).toContain(`(${filename})`);

    // --- Recall returns the memory ---
    const recalled = await handle.agent.recall('what is my name', 'thread-42');
    expect(recalled.length).toBeGreaterThan(0);
    expect(recalled[0]!.content).toContain('Douglas');
  });

  it('rejects malicious threadId with path traversal (defense-in-depth)', async () => {
    handle = await createTempAgent({
      memory: { enabled: true, extractionEnabled: false, samplingRate: 0 },
      knowledge: { enabled: false },
    });

    await expect(
      handle.agent.remember('x', 'user', '../../../tmp/evil'),
    ).rejects.toThrow(/invalid threadid/i);
  });
});

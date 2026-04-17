/**
 * E2E helpers: FakeLLM scripted responses, fetch router, tempAgent factory.
 *
 * These helpers let each E2E scenario exercise the full Agent pipeline
 * without hitting real network. The fetch router matches requests by endpoint
 * (and optionally by turn) and returns scripted SSE or JSON bodies.
 */

import { vi, type Mock } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent } from '../../src/agent.js';
import type { AgentConfigInput } from '../../src/config/config.js';
import type { AgentEvent } from '../../src/contracts/entities/agent-event.js';

// ---------------------------------------------------------------------------
// SSE / JSON response builders
// ---------------------------------------------------------------------------

/** Build an SSE Response body from a list of `data: ...` frames. */
export function createSSEResponse(events: string[]): Response {
  const text = events.map(e => (e.startsWith('data:') ? e : `data: ${e}`)).join('\n\n') + '\n\n';
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

/** Build an /embeddings JSON response. */
export function createEmbeddingResponse(vectors: number[][]): Response {
  return new Response(
    JSON.stringify({ data: vectors.map(embedding => ({ embedding })) }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

// ---------------------------------------------------------------------------
// Chunk builders — build common SSE payloads without string-concat mistakes
// ---------------------------------------------------------------------------

export interface TextChunkOptions {
  content: string;
  finishReason?: 'stop' | 'tool_calls';
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/** Build an SSE frame sequence for a simple text response. */
export function textResponseFrames(opts: TextChunkOptions): string[] {
  const frames: string[] = [];
  if (opts.content) {
    frames.push(JSON.stringify({ choices: [{ delta: { content: opts.content }, index: 0 }] }));
  }
  const done: Record<string, unknown> = {
    choices: [{ finish_reason: opts.finishReason ?? 'stop', index: 0 }],
  };
  if (opts.usage) done.usage = opts.usage;
  frames.push(JSON.stringify(done));
  return frames;
}

export interface ToolCallChunkOptions {
  toolCallId: string;
  name: string;
  arguments: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/** Build an SSE frame sequence for a tool_call-only response (no text). */
export function toolCallFrames(opts: ToolCallChunkOptions): string[] {
  const frames: string[] = [];
  // Chunk 1: id + name
  frames.push(JSON.stringify({
    choices: [{
      delta: { tool_calls: [{ index: 0, id: opts.toolCallId, function: { name: opts.name, arguments: '' } }] },
      index: 0,
    }],
  }));
  // Chunk 2: arguments (in one piece)
  frames.push(JSON.stringify({
    choices: [{
      delta: { tool_calls: [{ index: 0, function: { arguments: opts.arguments } }] },
      index: 0,
    }],
  }));
  // Done
  const done: Record<string, unknown> = {
    choices: [{ finish_reason: 'tool_calls', index: 0 }],
  };
  if (opts.usage) done.usage = opts.usage;
  frames.push(JSON.stringify(done));
  return frames;
}

// ---------------------------------------------------------------------------
// Scripted fetch router
// ---------------------------------------------------------------------------

export type FetchTurnResponse = Response | (() => Response | Promise<Response>);

export interface FetchScript {
  /** Chat completions responses, consumed in order across turns. */
  chat?: FetchTurnResponse[];
  /** Embeddings responses, consumed in order. Falls back to zero vectors. */
  embeddings?: FetchTurnResponse[];
  /** Catch-all: called if no chat/embeddings match (rare). */
  fallback?: (url: string) => Response | Promise<Response>;
}

export interface ScriptedFetchMock {
  mock: Mock;
  /** Request bodies captured per chat turn (parsed JSON). */
  chatRequests: Array<Record<string, unknown>>;
  /** Request bodies captured per embeddings call (parsed JSON). */
  embeddingRequests: Array<Record<string, unknown>>;
}

/**
 * Install a fetch mock that routes by endpoint and consumes scripted responses
 * in order. Each chat turn pops `chat[n]`; each embeddings call pops `embeddings[n]`.
 * The mock captures the parsed request body of every call for later assertions.
 */
export function scriptFetch(script: FetchScript): ScriptedFetchMock {
  let chatIdx = 0;
  let embedIdx = 0;
  const chatRequests: Array<Record<string, unknown>> = [];
  const embeddingRequests: Array<Record<string, unknown>> = [];

  const mock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const bodyRaw = (init?.body ?? (input as Request).body) as string | undefined;
    let body: Record<string, unknown> = {};
    if (typeof bodyRaw === 'string') {
      try { body = JSON.parse(bodyRaw) as Record<string, unknown>; } catch { /* non-JSON */ }
    }

    if (urlStr.includes('/chat/completions')) {
      chatRequests.push(body);
      const next = script.chat?.[chatIdx++];
      if (!next) throw new Error(`No chat response scripted for turn ${chatIdx} (url: ${urlStr})`);
      return typeof next === 'function' ? await next() : next;
    }

    if (urlStr.includes('/embeddings')) {
      embeddingRequests.push(body);
      const next = script.embeddings?.[embedIdx++];
      if (next) return typeof next === 'function' ? await next() : next;
      // Default: return zero vector matching the input count (if any)
      const input = body.input;
      const count = Array.isArray(input) ? input.length : 1;
      return createEmbeddingResponse(Array.from({ length: count }, () => [0, 0, 0, 0]));
    }

    if (script.fallback) return script.fallback(urlStr);
    throw new Error(`Unexpected fetch URL (no script match): ${urlStr}`);
  });

  return { mock: mock as unknown as Mock, chatRequests, embeddingRequests };
}

// ---------------------------------------------------------------------------
// Stream consumer
// ---------------------------------------------------------------------------

/** Collect every event emitted by an AsyncIterable into an array. */
export async function consumeStream(iter: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of iter) events.push(event);
  return events;
}

// ---------------------------------------------------------------------------
// Temp Agent factory
// ---------------------------------------------------------------------------

export interface TempAgentHandle {
  agent: Agent;
  tempDir: string;
  memoryDir: string;
  dbPath: string;
  cleanup: () => Promise<void>;
}

/**
 * Create an Agent rooted in a fresh temp dir, with memory + knowledge enabled
 * by default. Pass overrides to tweak any field (including disabling subsystems).
 */
export async function createTempAgent(
  overrides: Partial<AgentConfigInput> = {},
): Promise<TempAgentHandle> {
  const tempDir = await mkdtemp(join(tmpdir(), 'agentx-e2e-'));
  const memoryDir = join(tempDir, 'memory') + '/';
  const dbPath = join(tempDir, 'agent.db');

  // Separate memory/knowledge overrides so we can merge them into our defaults
  // without the outer `...rest` spread accidentally replacing the whole object.
  const { memory: memoryOverride, knowledge: knowledgeOverride, dbPath: dbPathOverride, ...rest } = overrides;

  const agent = Agent.create({
    apiKey: 'test-key',
    model: 'openai/gpt-4o-mini',
    baseUrl: 'https://api.test/v1',
    logLevel: 'silent',
    dbPath: dbPathOverride ?? dbPath,
    memory: { enabled: true, memoryDir, samplingRate: 0, extractionInterval: 9999, ...memoryOverride },
    knowledge: { enabled: true, chunkSize: 64, chunkOverlap: 8, ...knowledgeOverride },
    ...rest,
  });

  const cleanup = async (): Promise<void> => {
    try { await agent.destroy(); } catch { /* already destroyed */ }
    await rm(tempDir, { recursive: true, force: true });
  };

  return { agent, tempDir, memoryDir, dbPath, cleanup };
}

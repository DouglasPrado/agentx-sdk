import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../../../src/agent.js';
import type { VectorStore, ConversationStore } from '../../../src/contracts/entities/stores.js';
import type { ChatMessage } from '../../../src/contracts/entities/chat-message.js';

function createCustomVectorStore(): VectorStore {
  return {
    upsert: vi.fn(),
    search: vi.fn(() => []),
    delete: vi.fn(),
    listAll: vi.fn(() => []),
    deleteBySource: vi.fn(),
  };
}

function createCustomConversationStore(): ConversationStore {
  const threads = new Map<string, ChatMessage[]>();
  return {
    appendMessage: vi.fn((msg: ChatMessage, threadId: string) => {
      if (!threads.has(threadId)) threads.set(threadId, []);
      threads.get(threadId)!.push(msg);
    }),
    listThread: vi.fn((threadId: string) => threads.get(threadId) ?? []),
    listPinned: vi.fn((threadId: string) => (threads.get(threadId) ?? []).filter(m => m.pinned)),
    clearThread: vi.fn((threadId: string) => threads.delete(threadId)),
  };
}

describe('Pluggable Stores (ENT-011)', () => {
  it('should create agent with file-based memory enabled', () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: true },
      knowledge: { enabled: false },
    });
    expect(agent).toBeDefined();
  });

  it('should save and recall with file-based memory', async () => {
    // Mock fetch for the LLM relevance selection call
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"selected_memories":[]}' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        }),
        { status: 200 },
      );
    });

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: true },
      knowledge: { enabled: false },
    });

    const filename = await agent.remember('Custom file memory works');
    expect(typeof filename).toBe('string');
    expect(filename).toMatch(/\.md$/);

    await agent.destroy();
    vi.restoreAllMocks();
  });

  it('should accept a custom VectorStore', () => {
    const store = createCustomVectorStore();
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: true, store },
    });

    expect(agent).toBeDefined();
  });

  it('should accept a custom ConversationStore', () => {
    const store = createCustomConversationStore();
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
      conversation: { store },
    });

    expect(agent).toBeDefined();
  });

  it('should export stores and FileMemorySystem from index.ts', async () => {
    const { SQLiteVectorStore, SQLiteDatabase, FileMemorySystem } = await import('../../../src/index.js');
    expect(SQLiteVectorStore).toBeDefined();
    expect(SQLiteDatabase).toBeDefined();
    expect(FileMemorySystem).toBeDefined();
  });
});

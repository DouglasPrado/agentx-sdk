import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryManager } from '../../../src/memory/memory-manager.js';
import type { MemoryStore } from '../../../src/contracts/entities/stores.js';
import type { Memory } from '../../../src/contracts/entities/memory.js';

function createMockStore(): MemoryStore & { saved: Memory[] } {
  const saved: Memory[] = [];
  return {
    saved,
    save: vi.fn((m: Memory) => { saved.push(m); return m; }),
    search: vi.fn(() => []),
    findById: vi.fn((id: string) => saved.find(m => m.id === id) ?? null),
    incrementAccess: vi.fn(),
    deleteLowConfidence: vi.fn(() => 0),
    listByScope: vi.fn(() => []),
  };
}

function createMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'mem-1', content: 'test fact', scope: 'persistent', category: 'fact',
    confidence: 0.8, accessCount: 0, source: 'extracted',
    createdAt: Date.now(), lastAccessedAt: Date.now(), state: 'active',
    ...overrides,
  };
}

describe('Memory State Transitions', () => {
  let store: MemoryStore & { saved: Memory[] };
  let manager: MemoryManager;

  beforeEach(() => {
    store = createMockStore();
    manager = new MemoryManager({ store, samplingRate: 0 });
  });

  it('saveExplicit should create memory in active state', () => {
    const mem = manager.saveExplicit('user likes TS');
    expect(mem.state).toBe('active');
    expect(mem.confidence).toBe(1.0);
  });

  it('saveExtracted should create memory in active state', () => {
    const mem = manager.saveExtracted('user is a dev', 'fact');
    expect(mem.state).toBe('active');
    expect(mem.confidence).toBe(0.8);
  });

  it('recall should transition active memory to reinforced', () => {
    const mem = createMemory({ state: 'active' });
    vi.mocked(store.search).mockReturnValue([mem]);

    manager.recall('test');

    // Should have saved with reinforced state
    const savedCall = vi.mocked(store.save).mock.calls.find(
      c => c[0]!.id === 'mem-1' && c[0]!.state === 'reinforced'
    );
    expect(savedCall).toBeDefined();
  });

  it('recall should transition decaying memory to reinforced', () => {
    const mem = createMemory({ state: 'decaying', confidence: 0.5 });
    vi.mocked(store.search).mockReturnValue([mem]);

    manager.recall('test');

    const savedCall = vi.mocked(store.save).mock.calls.find(
      c => c[0]!.id === 'mem-1' && c[0]!.state === 'reinforced'
    );
    expect(savedCall).toBeDefined();
  });

  it('applyDecay should transition to decaying state', () => {
    const mem = createMemory({ confidence: 0.5, state: 'active' });
    vi.mocked(store.listByScope).mockReturnValue([mem]);

    manager.applyDecay();

    const savedMem = vi.mocked(store.save).mock.calls[0]![0]!;
    expect(savedMem.state).toBe('decaying');
    expect(savedMem.confidence).toBeCloseTo(0.475);
  });

  it('applyDecay should transition to expired when below threshold', () => {
    const mem = createMemory({ confidence: 0.105, state: 'active' });
    vi.mocked(store.listByScope).mockReturnValue([mem]);

    manager.applyDecay();

    const savedMem = vi.mocked(store.save).mock.calls[0]![0]!;
    expect(savedMem.state).toBe('expired');
  });

  it('consolidate should transition to consolidated state', () => {
    const mem = createMemory({ id: 'mem-1', state: 'active', confidence: 0.7 });
    store.saved.push(mem);

    const result = manager.consolidate('mem-1', 'merged content');
    expect(result).not.toBeNull();
    expect(result!.state).toBe('consolidated');
    expect(result!.content).toBe('merged content');
    expect(result!.confidence).toBeCloseTo(0.8);
  });

  it('consolidate should return null for expired memory', () => {
    const mem = createMemory({ id: 'mem-1', state: 'expired' });
    store.saved.push(mem);

    const result = manager.consolidate('mem-1', 'merged');
    expect(result).toBeNull();
  });

  it('consolidate should return null for nonexistent memory', () => {
    const result = manager.consolidate('nonexistent', 'merged');
    expect(result).toBeNull();
  });
});

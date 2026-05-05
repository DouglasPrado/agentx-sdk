import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for agent pool — isolation, caching, TTL, and cleanup.
 *
 * Since agentx-sdk is a local file: link, vi.mock doesn't reliably intercept it.
 * Instead we mock config + tools so Agent.create succeeds with minimal setup,
 * then test pool behavior through exported functions.
 */

vi.mock(
  '../../../../examples/teams-bot/src/config.js',
  () => ({
    config: {
      agent: { apiKey: 'test-key', model: 'test-model' },
      embedding: { apiKey: undefined, baseUrl: undefined, model: undefined },
      mcp: { albert: { url: undefined } },
      database: { url: undefined },
    },
  }),
);

vi.mock(
  '../../../../examples/teams-bot/src/tools.js',
  () => ({
    createTools: vi.fn(() => []),
  }),
);

vi.mock(
  '../../../../examples/teams-bot/src/queries.js',
  () => ({
    queries: [],
  }),
);

vi.mock('pg', () => ({
  default: { Pool: vi.fn() },
  Pool: vi.fn(),
}));

vi.mock(
  '../../../../examples/teams-bot/src/skills/push-campaign.js',
  () => ({ pushCampaignSkill: { name: 'push_campaign', description: 'stub', instructions: 'stub', inputSchema: { type: 'object', properties: {} } } }),
);

vi.mock(
  '../../../../examples/teams-bot/src/skills/onboarding.js',
  () => ({ onboardingSkill: { name: 'onboarding', description: 'stub', instructions: 'stub', inputSchema: { type: 'object', properties: {} } } }),
);

vi.mock(
  '../../../../examples/teams-bot/src/skills/blog-content.js',
  () => ({ blogContentSkill: { name: 'blog_content', description: 'stub', instructions: 'stub', inputSchema: { type: 'object', properties: {} } } }),
);

// Mock fetch to prevent real HTTP calls from Agent internals
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

import {
  getAgent,
  destroyAgent,
  destroyAll,
  getPoolStats,
  _resetPool,
} from '../../../../examples/teams-bot/src/agent-factory.js';

// Ensure this exists after fix
const { MAX_POOL_SIZE } = await import('../../../../examples/teams-bot/src/agent-factory.js');

describe('Agent Pool (agent-factory)', () => {
  beforeEach(() => {
    _resetPool();
  });

  describe('pool size limit (#88)', () => {
    beforeEach(() => {
      _resetPool(3); // use small limit for testing
    });

    it('exports MAX_POOL_SIZE', () => {
      expect(typeof MAX_POOL_SIZE).toBe('number');
      expect(MAX_POOL_SIZE).toBeGreaterThan(0);
    });

    it('getPoolStats includes maxSize', async () => {
      _resetPool(3);
      const stats = getPoolStats();
      expect(stats).toHaveProperty('maxSize');
      expect(stats.maxSize).toBe(3);
    });

    it('evicts oldest agent when pool is at capacity', async () => {
      _resetPool(3);
      await getAgent('conv-a');
      await getAgent('conv-b');
      await getAgent('conv-c');
      expect(getPoolStats().size).toBe(3);

      // Adding a 4th should evict the oldest (conv-a)
      await getAgent('conv-d');
      const stats = getPoolStats();
      expect(stats.size).toBe(3);
      expect(stats.conversationIds).not.toContain('conv-a');
      expect(stats.conversationIds).toContain('conv-d');
    });

    it('evicts by lastUsedAt (LRU) — most recently used survives', async () => {
      _resetPool(2);
      await getAgent('conv-old');
      await getAgent('conv-new');
      // Access conv-old to make it more recently used
      await getAgent('conv-old');

      // Adding a 3rd — conv-new is now the oldest (LRU)
      await getAgent('conv-third');
      const stats = getPoolStats();
      expect(stats.size).toBe(2);
      expect(stats.conversationIds).not.toContain('conv-new');
      expect(stats.conversationIds).toContain('conv-old');
      expect(stats.conversationIds).toContain('conv-third');
    });
  });

  afterEach(async () => {
    await destroyAll();
  });

  it('creates isolated agents for different conversations', async () => {
    const agent1 = await getAgent('conv-1');
    const agent2 = await getAgent('conv-2');

    expect(agent1).not.toBe(agent2);
    expect(getPoolStats().size).toBe(2);
  });

  it('returns cached agent for same conversationId', async () => {
    const first = await getAgent('conv-1');
    const second = await getAgent('conv-1');

    expect(first).toBe(second);
    expect(getPoolStats().size).toBe(1);
  });

  it('deduplicates concurrent init for same conversationId', async () => {
    const [a, b] = await Promise.all([
      getAgent('conv-1'),
      getAgent('conv-1'),
    ]);

    expect(a).toBe(b);
    expect(getPoolStats().size).toBe(1);
  });

  it('getPoolStats returns correct size and ids', async () => {
    await getAgent('conv-a');
    await getAgent('conv-b');

    const stats = getPoolStats();
    expect(stats.size).toBe(2);
    expect(stats.conversationIds).toContain('conv-a');
    expect(stats.conversationIds).toContain('conv-b');
  });

  it('destroyAgent removes from pool', async () => {
    const agent = await getAgent('conv-1');
    const destroySpy = vi.spyOn(agent, 'destroy');
    expect(getPoolStats().size).toBe(1);

    await destroyAgent('conv-1');

    expect(getPoolStats().size).toBe(0);
    expect(destroySpy).toHaveBeenCalledOnce();
  });

  it('destroyAgent does nothing for unknown conversationId', async () => {
    await destroyAgent('nonexistent');
    expect(getPoolStats().size).toBe(0);
  });

  it('destroyAll clears entire pool', async () => {
    const agents = await Promise.all([
      getAgent('conv-1'),
      getAgent('conv-2'),
      getAgent('conv-3'),
    ]);
    const spies = agents.map(a => vi.spyOn(a, 'destroy'));
    expect(getPoolStats().size).toBe(3);

    await destroyAll();

    expect(getPoolStats().size).toBe(0);
    for (const spy of spies) {
      expect(spy).toHaveBeenCalledOnce();
    }
  });

  it('getAgent after destroyAgent creates a new agent', async () => {
    const first = await getAgent('conv-1');
    await destroyAgent('conv-1');

    const second = await getAgent('conv-1');
    expect(second).not.toBe(first);
  });

  describe('log injection prevention (#91)', () => {
    it('sanitizes newline in conversationId before logging', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const maliciousId = 'conv-1\n[FAKE] Admin password: admin123';
      await getAgent(maliciousId);
      const allLogs = logSpy.mock.calls.flat().join('\n');
      expect(allLogs).not.toMatch(/\n\[FAKE\]/);
      logSpy.mockRestore();
    });

    it('sanitizes ANSI escape sequences in conversationId before logging', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const maliciousId = 'conv-2\x1b[31mRED_TEXT\x1b[0m';
      await getAgent(maliciousId);
      const allLogs = logSpy.mock.calls.flat().join('');
      expect(allLogs).not.toContain('\x1b[31m');
      logSpy.mockRestore();
    });

    it('sanitizes carriage return in conversationId before logging', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const maliciousId = 'conv-3\r[INJECTED]';
      await getAgent(maliciousId);
      const allLogs = logSpy.mock.calls.flat().join('');
      expect(allLogs).not.toContain('\r');
      logSpy.mockRestore();
    });
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../src/agent.js';

describe('Agent — additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // stream() — input validation
  // ---------------------------------------------------------------------------

  it('stream() throws for invalid threadId', async () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    await expect(async () => {
      for await (const _ of agent.stream('hi', { threadId: '../escape' })) {
        /* consume */
      }
    }).rejects.toThrow(/Invalid threadId/);
  });

  // ---------------------------------------------------------------------------
  // clearHistory()
  // ---------------------------------------------------------------------------

  it('clearHistory() removes messages for a thread', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{"content":"hi"},"index":0}]}\n\n',
      'data: {"choices":[{"finish_reason":"stop","index":0}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\n',
    ].join('');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/embeddings')) {
        return new Response(JSON.stringify({ data: [{ embedding: [0.1] }] }), { status: 200 });
      }
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode(sseData));
            c.close();
          },
        }),
        { status: 200 },
      );
    });

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    await agent.chat('hello');
    expect(agent.getHistory().length).toBeGreaterThan(0);

    agent.clearHistory();
    expect(agent.getHistory()).toEqual([]);
  });

  it('clearHistory() accepts a custom threadId', () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });
    // Should not throw even when thread has no messages
    expect(() => agent.clearHistory('custom-thread')).not.toThrow();
  });

  // ---------------------------------------------------------------------------
  // Skills API
  // ---------------------------------------------------------------------------

  it('listSkills() returns registered skills', () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });
    expect(agent.listSkills()).toEqual([]);

    agent.addSkill({ name: 'alpha', description: 'a', instructions: 'do a' });
    agent.addSkill({ name: 'beta', description: 'b', instructions: 'do b' });

    const names = agent.listSkills().map((s) => s.name);
    expect(names).toContain('alpha');
    expect(names).toContain('beta');
  });

  it('removeSkill() returns true on removal and false for unknown', () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    agent.addSkill({ name: 'temp-skill', description: 't', instructions: 'tmp' });
    expect(agent.removeSkill('temp-skill')).toBe(true);
    expect(agent.removeSkill('temp-skill')).toBe(false);
    expect(agent.removeSkill('never-existed')).toBe(false);
  });

  it('activateSkillsForPaths() returns names of activated conditional skills', () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    agent.addSkill({
      name: 'ts-helper',
      description: 'TS files',
      instructions: 'help with ts',
      paths: ['**/*.ts'],
    });

    const activated = agent.activateSkillsForPaths(['src/foo.ts']);
    expect(activated).toContain('ts-helper');

    // No matches yields empty array
    const none = agent.activateSkillsForPaths(['unrelated.md']);
    expect(none).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Turn-end hooks
  // ---------------------------------------------------------------------------

  it('addTurnEndHook() registers a hook without throwing', () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    expect(() =>
      agent.addTurnEndHook({
        name: 'noop',
        run: async () => {
          /* no-op */
        },
      }),
    ).not.toThrow();
  });

  // ---------------------------------------------------------------------------
  // Context window
  // ---------------------------------------------------------------------------

  it('getEffectiveContextWindow() returns the configured maxContextTokens override', () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
      maxContextTokens: 42_000,
    });

    expect(agent.getEffectiveContextWindow()).toBe(42_000);
  });

  it('getEffectiveContextWindow() returns a positive number for the default model', () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });
    expect(agent.getEffectiveContextWindow()).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // MCP health
  // ---------------------------------------------------------------------------

  it('getHealth() returns an empty servers list when no MCP servers connected', () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    const health = agent.getHealth();
    expect(health).toHaveProperty('servers');
    expect(Array.isArray(health.servers)).toBe(true);
    expect(health.servers).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Memory subsystem disabled — guards
  // ---------------------------------------------------------------------------

  it('remember() rejects when memory subsystem is disabled', async () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    await expect(agent.remember('something')).rejects.toThrow(/Memory subsystem not enabled/);
  });

  it('recall() rejects when memory subsystem is disabled', async () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    await expect(agent.recall('anything')).rejects.toThrow(/Memory subsystem not enabled/);
  });

  // ---------------------------------------------------------------------------
  // Knowledge subsystem disabled — guards
  // ---------------------------------------------------------------------------

  it('ingestKnowledge() rejects when knowledge subsystem is disabled', async () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    await expect(agent.ingestKnowledge({ id: 'doc-1', content: 'body' })).rejects.toThrow(
      /Knowledge subsystem not enabled/,
    );
  });

  it('searchKnowledge() rejects when knowledge subsystem is disabled', async () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    await expect(agent.searchKnowledge('q')).rejects.toThrow(/Knowledge subsystem not enabled/);
  });

  // ---------------------------------------------------------------------------
  // fork()
  // ---------------------------------------------------------------------------

  it('fork({ background: true }) returns "" immediately without awaiting work', async () => {
    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    // Even if fetch were called, background mode should return synchronously-resolving ''
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    );

    const start = Date.now();
    const result = await agent.fork('do something', { background: true });
    const elapsed = Date.now() - start;

    expect(result).toBe('');
    // Should return well before any pending fetch would resolve
    expect(elapsed).toBeLessThan(500);
  });

  it('fork({ tools }) registers the provided tools on the child', async () => {
    // Capture tool calls registered on the child agent via addTool spy
    const addToolSpy = vi.spyOn(Agent.prototype, 'addTool');

    const sseData = [
      'data: {"choices":[{"delta":{"content":"ok"},"index":0}]}\n\n',
      'data: {"choices":[{"finish_reason":"stop","index":0}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\n',
    ].join('');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/embeddings')) {
        return new Response(JSON.stringify({ data: [{ embedding: [0.1] }] }), { status: 200 });
      }
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode(sseData));
            c.close();
          },
        }),
        { status: 200 },
      );
    });

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    const childTool = {
      name: 'child-tool',
      description: 'only for child',
      parameters: z.object({}),
      execute: async () => 'ok',
    };

    await agent.fork('run', { tools: [childTool] });

    // Parent never had `child-tool` registered, so the spy should observe
    // addTool('child-tool') being invoked on the child.
    const childToolCalls = addToolSpy.mock.calls.filter((c) => c[0]?.name === 'child-tool');
    expect(childToolCalls.length).toBeGreaterThanOrEqual(1);

    await agent.destroy();
  });

  // ---------------------------------------------------------------------------
  // chat() error rethrow
  // ---------------------------------------------------------------------------

  it('chat() rethrows non-recoverable errors from the underlying stream', async () => {
    // Make the chat completion request reject — react-loop will emit error event
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/embeddings')) {
        return new Response(JSON.stringify({ data: [{ embedding: [0.1] }] }), { status: 200 });
      }
      throw new Error('network down');
    });

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    await expect(agent.chat('hi')).rejects.toThrow();
  });

  // ---------------------------------------------------------------------------
  // loadSkillsDir()
  // ---------------------------------------------------------------------------

  it('loadSkillsDir() returns the count reported by the skill manager', async () => {
    const { SkillManager } = await import('../../src/skills/skill-manager.js');
    const loadSpy = vi.spyOn(SkillManager.prototype, 'loadFromDirectory').mockResolvedValue(3);

    const agent = Agent.create({
      apiKey: 'test-key',
      memory: { enabled: false },
      knowledge: { enabled: false },
    });

    const count = await agent.loadSkillsDir('/some/dir');
    expect(count).toBe(3);
    expect(loadSpy).toHaveBeenCalledWith('/some/dir');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SkillManager } from '../../../src/skills/skill-manager.js';
import type { AgentSkill } from '../../../src/contracts/entities/agent-skill.js';

function createSkill(overrides: Partial<AgentSkill> = {}): AgentSkill {
  return {
    name: 'test-skill',
    description: 'A test skill',
    instructions: 'Do something',
    ...overrides,
  };
}

describe('SkillManager', () => {
  let manager: SkillManager;

  beforeEach(() => {
    manager = new SkillManager();
  });

  // --- Registration ---

  it('should register and list skills', () => {
    manager.register(createSkill({ name: 'a' }));
    manager.register(createSkill({ name: 'b' }));
    expect(manager.listSkills()).toHaveLength(2);
  });

  it('should unregister skills', () => {
    manager.register(createSkill({ name: 'a' }));
    manager.unregister('a');
    expect(manager.listSkills()).toHaveLength(0);
  });

  // --- Prefix matching ---

  it('should match by triggerPrefix', async () => {
    manager.register(createSkill({ name: 'review', triggerPrefix: '/review' }));

    const matches = await manager.match('/review this code', { threadId: 't1' });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.name).toBe('review');
  });

  it('should not match prefix if not at start', async () => {
    manager.register(createSkill({ name: 'review', triggerPrefix: '/review' }));

    const matches = await manager.match('please /review this', { threadId: 't1' });
    expect(matches).toHaveLength(0);
  });

  // --- Alias matching ---

  it('should match by alias', async () => {
    manager.register(createSkill({
      name: 'code-review',
      aliases: ['review', 'cr'],
    }));

    const matches = await manager.match('/review this', { threadId: 't1' });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.name).toBe('code-review');
  });

  it('should match alias with / prefix already included', async () => {
    manager.register(createSkill({
      name: 'code-review',
      aliases: ['/cr'],
    }));

    const matches = await manager.match('/cr file.ts', { threadId: 't1' });
    expect(matches).toHaveLength(1);
  });

  // --- Custom match ---

  it('should match by custom match function', async () => {
    manager.register(createSkill({
      name: 'code',
      match: (input) => input.includes('write code'),
    }));

    const matches = await manager.match('please write code for me', { threadId: 't1' });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.name).toBe('code');
  });

  // --- Priority ---

  it('should prioritize prefix over custom', async () => {
    manager.register(createSkill({
      name: 'prefix-skill',
      triggerPrefix: '/test',
      priority: 1,
    }));
    manager.register(createSkill({
      name: 'custom-skill',
      match: () => true,
      priority: 10,
    }));

    const matches = await manager.match('/test something', { threadId: 't1' });
    expect(matches[0]!.name).toBe('prefix-skill');
  });

  it('should prioritize prefix over alias', async () => {
    manager.register(createSkill({
      name: 'exact',
      triggerPrefix: '/review',
      priority: 1,
    }));
    manager.register(createSkill({
      name: 'aliased',
      aliases: ['review'],
      priority: 10,
    }));

    const matches = await manager.match('/review code', { threadId: 't1' });
    expect(matches[0]!.name).toBe('exact');
  });

  it('should sort by priority when match types are equal', async () => {
    manager.register(createSkill({ name: 'low', match: () => true, priority: 1 }));
    manager.register(createSkill({ name: 'high', match: () => true, priority: 10 }));

    const matches = await manager.match('any', { threadId: 't1' });
    expect(matches[0]!.name).toBe('high');
  });

  // --- Exclusive ---

  it('should respect exclusive mode', async () => {
    manager.register(createSkill({
      name: 'exclusive-skill',
      triggerPrefix: '/focus',
      exclusive: true,
    }));
    manager.register(createSkill({
      name: 'other-skill',
      match: () => true,
    }));

    const matches = await manager.match('/focus on task', { threadId: 't1' });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.name).toBe('exclusive-skill');
  });

  // --- Max active ---

  it('should limit to maxActiveSkills', async () => {
    const mgr = new SkillManager({ maxActiveSkills: 2 });
    mgr.register(createSkill({ name: 'a', match: () => true }));
    mgr.register(createSkill({ name: 'b', match: () => true }));
    mgr.register(createSkill({ name: 'c', match: () => true }));

    const matches = await mgr.match('any input', { threadId: 't1' });
    expect(matches).toHaveLength(2);
  });

  // --- isEnabled filter ---

  it('should filter out disabled skills', async () => {
    manager.register(createSkill({
      name: 'disabled',
      match: () => true,
      isEnabled: () => false,
    }));
    manager.register(createSkill({
      name: 'enabled',
      match: () => true,
    }));

    const matches = await manager.match('any', { threadId: 't1' });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.name).toBe('enabled');
  });

  // --- Semantic matching ---

  it('should not call embedding service when no skills are registered', async () => {
    const embedSingle = vi.fn();
    const mgr = new SkillManager({
      embeddingService: { embedSingle, embed: vi.fn() } as any,
    });

    const matches = await mgr.match('any input', { threadId: 't1' });
    expect(matches).toHaveLength(0);
    expect(embedSingle).not.toHaveBeenCalled();
  });

  it('should skip semantic match when all skills have prefix or custom match', async () => {
    const embedSingle = vi.fn();
    const mgr = new SkillManager({
      embeddingService: { embedSingle, embed: vi.fn() } as any,
    });

    mgr.register(createSkill({ name: 'with-prefix', triggerPrefix: '/test' }));
    mgr.register(createSkill({ name: 'with-match', match: () => false }));

    const matches = await mgr.match('random input', { threadId: 't1' });
    expect(embedSingle).not.toHaveBeenCalled();
  });

  // --- Conditional path activation ---

  it('should hold skills with paths as conditional', () => {
    manager.register(createSkill({
      name: 'ts-only',
      paths: ['src/**/*.ts'],
      match: () => true,
    }));

    // Not in listSkills (pending conditional)
    expect(manager.listSkills()).toHaveLength(0);
    expect(manager.listAllSkills()).toHaveLength(1);
  });

  it('should activate conditional skills when paths match', () => {
    manager.register(createSkill({
      name: 'ts-only',
      paths: ['src/**/*.ts'],
      match: () => true,
    }));

    const activated = manager.activateForPaths(['src/agent.ts']);
    expect(activated).toEqual(['ts-only']);
    expect(manager.listSkills()).toHaveLength(1);
  });

  it('should not activate for non-matching paths', () => {
    manager.register(createSkill({
      name: 'ts-only',
      paths: ['src/**/*.ts'],
    }));

    const activated = manager.activateForPaths(['docs/readme.md']);
    expect(activated).toEqual([]);
    expect(manager.listSkills()).toHaveLength(0);
  });

  it('should match activated conditional skills', async () => {
    manager.register(createSkill({
      name: 'ts-review',
      paths: ['src/**/*.ts'],
      match: () => true,
    }));

    manager.activateForPaths(['src/agent.ts']);

    const matches = await manager.match('any', { threadId: 't1' });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.name).toBe('ts-review');
  });

  // --- Prompt resolution ---

  it('should resolve static instructions', async () => {
    const skill = createSkill({ instructions: 'Do this thing' });
    const result = await manager.resolveInstructions(skill, '', {
      threadId: 't1', traceId: 'tr1',
    });
    expect(result).toBe('Do this thing');
  });

  it('should resolve getPrompt over static instructions', async () => {
    const skill = createSkill({
      instructions: 'static',
      getPrompt: async (args) => `Dynamic: ${args}`,
    });
    const result = await manager.resolveInstructions(skill, 'hello', {
      threadId: 't1', traceId: 'tr1',
    });
    expect(result).toBe('Dynamic: hello');
  });

  it('should substitute args in static instructions', async () => {
    const skill = createSkill({
      instructions: 'Review $file',
      argNames: ['file'],
    });
    const result = await manager.resolveInstructions(skill, 'main.ts', {
      threadId: 't1', traceId: 'tr1',
    });
    expect(result).toBe('Review main.ts');
  });

  // --- Budget-aware listing ---

  it('should build skill listing', () => {
    manager.register(createSkill({
      name: 'review',
      description: 'Code review',
      triggerPrefix: '/review',
    }));
    manager.register(createSkill({
      name: 'translate',
      description: 'Translation',
      whenToUse: 'When user needs text translated',
    }));

    const listing = manager.buildSkillListing(1000);
    expect(listing).toContain('/review');
    expect(listing).toContain('Translation');
    expect(listing).toContain('When user needs text translated');
  });

  it('should respect budget limit', () => {
    for (let i = 0; i < 20; i++) {
      manager.register(createSkill({
        name: `skill-${i}`,
        description: 'A '.repeat(50) + `skill ${i}`,
        match: () => true,
      }));
    }

    const listing = manager.buildSkillListing(200);
    // Should not include all 20 skills
    const lines = listing.split('\n').filter(Boolean);
    expect(lines.length).toBeLessThan(20);
  });

  it('should exclude modelInvocable=false skills from listing', () => {
    manager.register(createSkill({
      name: 'hidden',
      description: 'Hidden skill',
      modelInvocable: false,
      match: () => true,
    }));
    manager.register(createSkill({
      name: 'visible',
      description: 'Visible skill',
      match: () => true,
    }));

    const listing = manager.buildSkillListing(1000);
    expect(listing).not.toContain('hidden');
    expect(listing).toContain('visible');
  });

  // --- Invocation tracking ---

  it('should track invoked skills', () => {
    manager.markInvoked('review');
    manager.markInvoked('translate');
    expect(manager.getInvokedSkills()).toEqual(['review', 'translate']);
  });

  // --- File-based loading ---

  describe('loadFromDirectory', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'sm-load-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should load skills from directory', async () => {
      const skillDir = join(tempDir, 'review');
      await mkdir(skillDir);
      await writeFile(join(skillDir, 'SKILL.md'), `---
name: review
description: Code review
triggerPrefix: /review
---

Review code carefully.`);

      const count = await manager.loadFromDirectory(tempDir);
      expect(count).toBe(1);
      expect(manager.listSkills()).toHaveLength(1);
      expect(manager.listSkills()[0]!.name).toBe('review');
    });

    it('should load conditional skills separately', async () => {
      const skillDir = join(tempDir, 'ts-review');
      await mkdir(skillDir);
      await writeFile(join(skillDir, 'SKILL.md'), `---
name: ts-review
description: TypeScript review
paths: [src/**/*.ts]
---

Review TS code.`);

      await manager.loadFromDirectory(tempDir);
      expect(manager.listSkills()).toHaveLength(0); // conditional, not yet activated
      expect(manager.listAllSkills()).toHaveLength(1);
    });

    it('should return 0 for non-existent directory', async () => {
      const count = await manager.loadFromDirectory(join(tempDir, 'nope'));
      expect(count).toBe(0);
    });
  });
});

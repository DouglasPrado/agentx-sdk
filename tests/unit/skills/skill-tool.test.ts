import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillManager } from '../../../src/skills/skill-manager.js';
import { createSkillTool, SKILL_TOOL_NAME, buildSkillToolPrompt } from '../../../src/tools/skill-tool.js';
import { ToolExecutor } from '../../../src/tools/tool-executor.js';
import type { AgentSkill } from '../../../src/contracts/entities/agent-skill.js';
import { z } from 'zod';

function createSkill(overrides: Partial<AgentSkill> = {}): AgentSkill {
  return {
    name: 'test-skill',
    description: 'A test skill',
    instructions: 'Do something',
    ...overrides,
  };
}

describe('SkillTool', () => {
  let manager: SkillManager;
  let toolExecutor: ToolExecutor;
  let ctx: { threadId: string; traceId: string };

  beforeEach(() => {
    manager = new SkillManager();
    toolExecutor = new ToolExecutor();
    ctx = { threadId: 'thread-1', traceId: 'trace-1' };
  });

  function buildTool() {
    return createSkillTool(manager, toolExecutor, () => ctx);
  }

  it('should have correct name', () => {
    const tool = buildTool();
    expect(tool.name).toBe(SKILL_TOOL_NAME);
    expect(tool.name).toBe('Skill');
  });

  it('should invoke a skill by exact name', async () => {
    manager.register(createSkill({
      name: 'review',
      instructions: 'Review code carefully.',
    }));

    const tool = buildTool();
    const result = await tool.execute({ skill: 'review' }, new AbortController().signal);
    const content = typeof result === 'string' ? result : result.content;

    expect(content).toContain('Review code carefully.');
    expect(content).toContain('<skill name="review">');
    expect(content).toContain('Follow the instructions above');
  });

  it('should invoke a skill by alias', async () => {
    manager.register(createSkill({
      name: 'code-review',
      aliases: ['cr', 'review'],
      instructions: 'Review instructions.',
    }));

    const tool = buildTool();
    const result = await tool.execute({ skill: 'cr' }, new AbortController().signal);
    const content = typeof result === 'string' ? result : result.content;

    expect(content).toContain('Review instructions.');
  });

  it('should invoke a skill by alias with / prefix', async () => {
    manager.register(createSkill({
      name: 'code-review',
      aliases: ['/cr'],
      instructions: 'Review.',
    }));

    const tool = buildTool();
    const result = await tool.execute({ skill: '/cr' }, new AbortController().signal);
    const content = typeof result === 'string' ? result : result.content;

    expect(content).toContain('Review.');
  });

  it('should invoke a skill by triggerPrefix', async () => {
    manager.register(createSkill({
      name: 'translate',
      triggerPrefix: '/translate',
      instructions: 'Translate text.',
    }));

    const tool = buildTool();
    const result = await tool.execute({ skill: '/translate' }, new AbortController().signal);
    const content = typeof result === 'string' ? result : result.content;

    expect(content).toContain('Translate text.');
  });

  it('should pass args to resolveInstructions', async () => {
    manager.register(createSkill({
      name: 'review',
      instructions: 'Review $file carefully.',
      argNames: ['file'],
    }));

    const tool = buildTool();
    const result = await tool.execute({ skill: 'review', args: 'main.ts' }, new AbortController().signal);
    const content = typeof result === 'string' ? result : result.content;

    expect(content).toContain('Review main.ts carefully.');
  });

  it('should use getPrompt when available', async () => {
    manager.register(createSkill({
      name: 'dynamic',
      instructions: 'static',
      getPrompt: async (args) => `Dynamic prompt for: ${args}`,
    }));

    const tool = buildTool();
    const result = await tool.execute({ skill: 'dynamic', args: 'test' }, new AbortController().signal);
    const content = typeof result === 'string' ? result : result.content;

    expect(content).toContain('Dynamic prompt for: test');
  });

  it('should return error for non-existent skill', async () => {
    manager.register(createSkill({ name: 'review' }));

    const tool = buildTool();
    const result = await tool.execute({ skill: 'nonexistent' }, new AbortController().signal);
    const parsed = typeof result === 'string' ? { content: result, isError: false } : result;

    expect(parsed.content).toContain('not found');
    expect(parsed.content).toContain('review');
    expect(parsed.isError).toBe(true);
  });

  it('should return error for disabled skill', async () => {
    manager.register(createSkill({
      name: 'disabled-skill',
      isEnabled: () => false,
    }));

    const tool = buildTool();
    const result = await tool.execute({ skill: 'disabled-skill' }, new AbortController().signal);
    const parsed = typeof result === 'string' ? { content: result, isError: false } : result;

    expect(parsed.content).toContain('disabled');
    expect(parsed.isError).toBe(true);
  });

  it('should return error for modelInvocable=false skill', async () => {
    manager.register(createSkill({
      name: 'user-only',
      modelInvocable: false,
    }));

    const tool = buildTool();
    const result = await tool.execute({ skill: 'user-only' }, new AbortController().signal);
    const parsed = typeof result === 'string' ? { content: result, isError: false } : result;

    expect(parsed.content).toContain('cannot be invoked by the model');
    expect(parsed.isError).toBe(true);
  });

  it('should mark skill as invoked', async () => {
    manager.register(createSkill({ name: 'review' }));

    const tool = buildTool();
    await tool.execute({ skill: 'review' }, new AbortController().signal);

    expect(manager.getInvokedSkills()).toContain('review');
  });

  it('should register skill-scoped tools in ToolExecutor', async () => {
    const skillTool = {
      name: 'read_file',
      description: 'Read a file',
      parameters: z.object({ path: z.string() }),
      execute: async () => 'file content',
    };

    manager.register(createSkill({
      name: 'file-manager',
      instructions: 'Manage files.',
      tools: [skillTool],
    }));

    const tool = buildTool();
    await tool.execute({ skill: 'file-manager' }, new AbortController().signal);

    // Verify tool was registered in executor
    const registered = toolExecutor.listTools();
    expect(registered.some(t => t.name === 'read_file')).toBe(true);
  });

  it('should mention skill tools in result', async () => {
    manager.register(createSkill({
      name: 'file-manager',
      instructions: 'Manage files.',
      tools: [{
        name: 'read_file',
        description: 'Read',
        parameters: z.object({ path: z.string() }),
        execute: async () => 'ok',
      }],
    }));

    const tool = buildTool();
    const result = await tool.execute({ skill: 'file-manager' }, new AbortController().signal);
    const content = typeof result === 'string' ? result : result.content;

    expect(content).toContain('read_file');
    expect(content).toContain('provides tools');
  });

  it('should note model override if present', async () => {
    manager.register(createSkill({
      name: 'premium',
      instructions: 'Premium analysis.',
      model: 'anthropic/claude-opus-4-20250514',
    }));

    const tool = buildTool();
    const result = await tool.execute({ skill: 'premium' }, new AbortController().signal);
    const content = typeof result === 'string' ? result : result.content;

    expect(content).toContain('claude-opus');
  });

  it('should be marked as not concurrency-safe', () => {
    const tool = buildTool();
    expect(tool.isConcurrencySafe).toBe(false);
  });

  it('should handle empty args', async () => {
    manager.register(createSkill({
      name: 'simple',
      instructions: 'Simple instructions.',
    }));

    const tool = buildTool();
    const result = await tool.execute({ skill: 'simple' }, new AbortController().signal);
    const content = typeof result === 'string' ? result : result.content;

    expect(content).toContain('Simple instructions.');
  });

  it('should not double-register skill tools', async () => {
    const skillTool = {
      name: 'my_tool',
      description: 'A tool',
      parameters: z.object({}),
      execute: async () => 'ok',
    };

    manager.register(createSkill({
      name: 'skill-a',
      instructions: 'A',
      tools: [skillTool],
    }));

    const tool = buildTool();
    await tool.execute({ skill: 'skill-a' }, new AbortController().signal);
    await tool.execute({ skill: 'skill-a' }, new AbortController().signal);

    // Should only have registered once (deduplication via Set)
    const count = toolExecutor.listTools().filter(t => t.name === 'my_tool').length;
    expect(count).toBe(1);
  });
});

describe('buildSkillToolPrompt', () => {
  it('should include usage instructions', () => {
    const prompt = buildSkillToolPrompt('- /review: Code review\n- /translate: Translation');
    expect(prompt).toContain('Skill tool');
    expect(prompt).toContain('/review');
    expect(prompt).toContain('BEFORE generating');
    expect(prompt).toContain('<skill>');
  });

  it('should include the listing', () => {
    const prompt = buildSkillToolPrompt('- /foo: bar');
    expect(prompt).toContain('/foo: bar');
  });
});

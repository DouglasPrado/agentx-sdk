import { describe, it, expect } from 'vitest';
import { buildToolUsagePrompt, buildEnvironmentPrompt } from '../../../src/core/prompt-builders.js';
import type { AgentTool } from '../../../src/contracts/entities/agent-tool.js';
import { z } from 'zod';

function createTool(overrides: Partial<AgentTool> = {}): AgentTool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    parameters: z.object({}),
    execute: async () => 'ok',
    ...overrides,
  };
}

describe('buildToolUsagePrompt', () => {
  it('should return empty string for no tools', () => {
    expect(buildToolUsagePrompt([])).toBe('');
  });

  it('should list all tools with names and descriptions', () => {
    const tools = [
      createTool({ name: 'weather', description: 'Get weather data' }),
      createTool({ name: 'search', description: 'Search the web' }),
    ];

    const prompt = buildToolUsagePrompt(tools);
    expect(prompt).toContain('**weather**');
    expect(prompt).toContain('Get weather data');
    expect(prompt).toContain('**search**');
    expect(prompt).toContain('Search the web');
  });

  it('should include tool usage guidelines', () => {
    const prompt = buildToolUsagePrompt([createTool()]);
    expect(prompt).toContain('Tool Usage Guidelines');
    expect(prompt).toContain('do not guess');
    expect(prompt).toContain('parallel');
    expect(prompt).toContain('sequentially');
    expect(prompt).toContain('error');
  });

  it('should include destructive tools warning', () => {
    const tools = [
      createTool({ name: 'delete_file', description: 'Delete a file', isDestructive: true }),
      createTool({ name: 'read_file', description: 'Read a file' }),
    ];

    const prompt = buildToolUsagePrompt(tools);
    expect(prompt).toContain('Destructive Tools');
    expect(prompt).toContain('**delete_file**');
    expect(prompt).toContain('confirm with the user');
  });

  it('should not include destructive section when no destructive tools', () => {
    const prompt = buildToolUsagePrompt([createTool({ isReadOnly: true })]);
    expect(prompt).not.toContain('Destructive Tools');
  });

  it('should include concurrency hints when mixed safe/unsafe tools', () => {
    const tools = [
      createTool({ name: 'search', description: 'Search', isConcurrencySafe: true }),
      createTool({ name: 'read', description: 'Read', isConcurrencySafe: true }),
      createTool({ name: 'write', description: 'Write', isConcurrencySafe: false }),
    ];

    const prompt = buildToolUsagePrompt(tools);
    expect(prompt).toContain('Concurrency');
    expect(prompt).toContain('search, read');
    expect(prompt).toContain('one at a time');
  });

  it('should not include concurrency section when all tools are unsafe', () => {
    const tools = [
      createTool({ name: 'a', isConcurrencySafe: false }),
      createTool({ name: 'b' }), // default false
    ];

    const prompt = buildToolUsagePrompt(tools);
    expect(prompt).not.toContain('Concurrency');
  });

  it('should not include concurrency section when all tools are safe', () => {
    const tools = [
      createTool({ name: 'a', isConcurrencySafe: true }),
      createTool({ name: 'b', isConcurrencySafe: true }),
    ];

    const prompt = buildToolUsagePrompt(tools);
    expect(prompt).not.toContain('Concurrency');
  });

  it('should handle isDestructive as function (treated as not statically destructive)', () => {
    const tools = [
      createTool({ name: 'bash', isDestructive: () => true }),
    ];

    const prompt = buildToolUsagePrompt(tools);
    // Function-based isDestructive is not statically classified
    expect(prompt).not.toContain('Destructive Tools');
  });
});

describe('buildEnvironmentPrompt', () => {
  it('should include all provided fields', () => {
    const prompt = buildEnvironmentPrompt({
      cwd: '/home/user/project',
      platform: 'linux',
      model: 'claude-sonnet',
      date: '2026-04-07',
      isGitRepo: true,
      gitBranch: 'main',
    });

    expect(prompt).toContain('# Environment');
    expect(prompt).toContain('/home/user/project');
    expect(prompt).toContain('linux');
    expect(prompt).toContain('claude-sonnet');
    expect(prompt).toContain('2026-04-07');
    expect(prompt).toContain('Git repository: yes');
    expect(prompt).toContain('Branch: main');
  });

  it('should omit undefined fields', () => {
    const prompt = buildEnvironmentPrompt({ model: 'claude' });

    expect(prompt).toContain('Model: claude');
    expect(prompt).not.toContain('Working directory');
    expect(prompt).not.toContain('Platform');
    expect(prompt).not.toContain('Git');
  });

  it('should show git repo: no', () => {
    const prompt = buildEnvironmentPrompt({ isGitRepo: false });
    expect(prompt).toContain('Git repository: no');
    expect(prompt).not.toContain('Branch');
  });

  it('should include custom entries', () => {
    const prompt = buildEnvironmentPrompt({
      custom: { 'Node version': 'v22.0.0', 'Package manager': 'pnpm' },
    });

    expect(prompt).toContain('Node version: v22.0.0');
    expect(prompt).toContain('Package manager: pnpm');
  });

  it('should return minimal header with empty info', () => {
    const prompt = buildEnvironmentPrompt({});
    expect(prompt).toBe('# Environment');
  });
});

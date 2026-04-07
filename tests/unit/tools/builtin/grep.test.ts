import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createGrepTool } from '../../../../src/tools/builtin/grep.js';

describe('builtin/grep', () => {
  let tempDir: string;
  const signal = new AbortController().signal;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'grep-tool-'));
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'src', 'index.ts'), 'export function hello() {\n  return "world";\n}\n');
    await writeFile(join(tempDir, 'src', 'agent.ts'), 'class Agent {\n  run() {}\n}\n');
    await writeFile(join(tempDir, 'readme.md'), '# Hello World\n');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should return AgentTool with correct metadata', () => {
    const tool = createGrepTool();
    expect(tool.name).toBe('Grep');
    expect(tool.isConcurrencySafe).toBe(true);
    expect(tool.isReadOnly).toBe(true);
  });

  it('should find content matching regex', async () => {
    const tool = createGrepTool();
    const result = await tool.execute({ pattern: 'function', path: tempDir }, signal);
    const content = typeof result === 'string' ? result : result.content;
    expect(content).toContain('index.ts');
    expect(content).toContain('hello');
  });

  it('should filter by glob pattern', async () => {
    const tool = createGrepTool();
    const result = await tool.execute({ pattern: 'Hello', path: tempDir, glob: '*.md' }, signal);
    const content = typeof result === 'string' ? result : result.content;
    expect(content).toContain('readme.md');
    expect(content).not.toContain('index.ts');
  });

  it('should return no matches message', async () => {
    const tool = createGrepTool();
    const result = await tool.execute({ pattern: 'nonexistent_xyz', path: tempDir }, signal);
    const content = typeof result === 'string' ? result : result.content;
    expect(content).toContain('No matches');
  });

  it('should limit results', async () => {
    const tool = createGrepTool();
    const result = await tool.execute({ pattern: '\\{', path: tempDir, max_results: 1 }, signal);
    const content = typeof result === 'string' ? result : result.content;
    const lines = content.split('\n').filter(l => l.includes(':'));
    expect(lines.length).toBeLessThanOrEqual(2); // 1 match + possible context
  });
});

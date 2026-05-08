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
    await writeFile(
      join(tempDir, 'src', 'index.ts'),
      'export function hello() {\n  return "world";\n}\n',
    );
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
    const lines = content.split('\n').filter((l) => l.includes(':'));
    expect(lines.length).toBeLessThanOrEqual(2); // 1 match + possible context
  });

  describe('path containment (issue #68)', () => {
    it('should block path outside workingDir when workingDir is set', async () => {
      const tool = createGrepTool(tempDir);
      const outsideDir = tmpdir();
      const result = await tool.execute({ pattern: 'root', path: outsideDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toMatch(/traversal|outside|blocked/i);
    });

    it('should allow path inside workingDir when workingDir is set', async () => {
      const tool = createGrepTool(tempDir);
      const result = await tool.execute(
        { pattern: 'function', path: join(tempDir, 'src') },
        signal,
      );
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBeFalsy();
    });

    it('should default to workingDir when no path is given and workingDir is set', async () => {
      const tool = createGrepTool(tempDir);
      const result = await tool.execute({ pattern: 'function' }, signal);
      const content = typeof result === 'string' ? result : result.content;
      expect(content).toContain('index.ts');
    });

    it('should be backward compatible when no workingDir is set', async () => {
      const tool = createGrepTool();
      const result = await tool.execute({ pattern: 'function', path: tempDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBeFalsy();
    });
  });

  describe('ReDoS protection (issue #7)', () => {
    it('should reject patterns with nested quantifiers like (a+)+', async () => {
      const tool = createGrepTool();
      const result = await tool.execute({ pattern: '(a+)+b', path: tempDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toMatch(/complex|ReDoS/i);
    });

    it('should reject patterns with consecutive quantifiers like a+*', async () => {
      const tool = createGrepTool();
      const result = await tool.execute({ pattern: 'a+*', path: tempDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
    });

    it('should reject patterns with quantified character classes like [a-z]*+', async () => {
      const tool = createGrepTool();
      const result = await tool.execute({ pattern: '[a-z]*+', path: tempDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
    });

    it('should still accept safe patterns', async () => {
      const tool = createGrepTool();
      const result = await tool.execute({ pattern: 'function', path: tempDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBeFalsy();
    });

    it('should still accept patterns with single quantifiers', async () => {
      const tool = createGrepTool();
      const result = await tool.execute({ pattern: 'hel+o', path: tempDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBeFalsy();
    });
  });

  describe('ReDoS protection — alternation with external quantifier (issue #62)', () => {
    it('should reject (a|ab)*b — alternation group with * quantifier', async () => {
      const tool = createGrepTool();
      const result = await tool.execute({ pattern: '(a|ab)*b', path: tempDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toMatch(/complex|ReDoS/i);
    });

    it('should reject (a|a)+ — alternation group with + quantifier', async () => {
      const tool = createGrepTool();
      const result = await tool.execute({ pattern: '(a|a)+', path: tempDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
    });

    it('should still accept (foo|bar) without external quantifier', async () => {
      const tool = createGrepTool();
      const result = await tool.execute({ pattern: '(function|class)', path: tempDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBeFalsy();
    });
  });

  describe('ReDoS filter false positives (issue #145)', () => {
    it('allows (func\\w+)\\s*\\( — group with internal quantifier but no external one', async () => {
      const tool = createGrepTool();
      // Old filter flagged this via \\(.*[+*?]\\) which matched any group containing a quantifier
      const result = await tool.execute(
        {
          pattern: String.raw`(func\w+)\s*\(`,
          path: tempDir,
        },
        signal,
      );
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBeFalsy();
    });

    it('allows (https?://\\S+) — ? inside group is a safe quantifier', async () => {
      const tool = createGrepTool();
      const result = await tool.execute(
        {
          pattern: String.raw`(https?://\S+)`,
          path: tempDir,
        },
        signal,
      );
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBeFalsy();
    });

    it('still rejects (a+)+ — genuinely nested quantifier', async () => {
      const tool = createGrepTool();
      const result = await tool.execute({ pattern: '(a+)+', path: tempDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
    });

    it('still rejects (a|ab)* — alternation with external quantifier', async () => {
      const tool = createGrepTool();
      const result = await tool.execute({ pattern: '(a|ab)*', path: tempDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
    });
  });

  describe('pattern length cap (CodeQL js/polynomial-redos)', () => {
    it('rejects patterns longer than 1000 chars', async () => {
      const tool = createGrepTool();
      const huge = '('.repeat(2000);
      const result = await tool.execute({ pattern: huge, path: tempDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toMatch(/too long/i);
    });

    it('still accepts moderately long but safe patterns', async () => {
      const tool = createGrepTool();
      const pattern = 'a'.repeat(500);
      const result = await tool.execute({ pattern, path: tempDir }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBeFalsy();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { createBashTool } from '../../../../src/tools/builtin/bash.js';

describe('builtin/bash', () => {
  const signal = new AbortController().signal;

  it('should return AgentTool with correct metadata', () => {
    const tool = createBashTool();
    expect(tool.name).toBe('Bash');
    expect(tool.timeoutMs).toBe(120_000);
  });

  it('should execute simple command', async () => {
    const tool = createBashTool();
    const result = await tool.execute({ command: 'echo "hello world"' }, signal);
    const content = typeof result === 'string' ? result : result.content;
    expect(content).toContain('hello world');
  });

  it('should capture stderr on failure', async () => {
    const tool = createBashTool();
    const result = await tool.execute({ command: 'ls /nonexistent_path_xyz' }, signal);
    const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
    expect(parsed.isError).toBe(true);
  });

  it('should respect custom timeout', async () => {
    const tool = createBashTool();
    const result = await tool.execute({ command: 'sleep 10', timeout: 100 }, signal);
    const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
    expect(parsed.isError).toBe(true);
  });

  it('should return exit code in output', async () => {
    const tool = createBashTool();
    const result = await tool.execute({ command: 'exit 42' }, signal);
    const content = typeof result === 'string' ? result : result.content;
    expect(content).toContain('42');
  });

  it('should handle multi-line output', async () => {
    const tool = createBashTool();
    const result = await tool.execute({ command: 'echo "line1" && echo "line2"' }, signal);
    const content = typeof result === 'string' ? result : result.content;
    expect(content).toContain('line1');
    expect(content).toContain('line2');
  });
});

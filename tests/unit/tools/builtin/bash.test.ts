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
    const result = await tool.execute({ command: 'seq 2 3' }, signal);
    const content = typeof result === 'string' ? result : result.content;
    expect(content).toContain('2');
    expect(content).toContain('3');
  });

  describe('sandboxing: workingDir + allowedCommands (issue #23)', () => {
    it('should restrict cwd to workingDir when set', async () => {
      const tool = createBashTool({ workingDir: '/tmp' });
      const result = await tool.execute({ command: 'pwd' }, signal);
      const content = (typeof result === 'string' ? result : result.content).trim();
      // Must run inside /tmp, not the process cwd
      expect(content).toBe('/tmp');
    });

    it('should allow commands matching allowedCommands prefixes', async () => {
      const tool = createBashTool({ allowedCommands: ['echo', 'pwd'] });
      const result = await tool.execute({ command: 'echo allowed' }, signal);
      const content = typeof result === 'string' ? result : result.content;
      expect(content).toContain('allowed');
    });

    it('should block commands not in allowedCommands', async () => {
      const tool = createBashTool({ allowedCommands: ['echo'] });
      const result = await tool.execute({ command: 'ls /' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toMatch(/not allowed|allowedCommands/i);
    });

    it('should allow all commands when allowedCommands is not set', async () => {
      const tool = createBashTool(); // no restrictions
      const result = await tool.execute({ command: 'echo unrestricted' }, signal);
      const content = typeof result === 'string' ? result : result.content;
      expect(content).toContain('unrestricted');
    });
  });

  describe('metacharacter injection via allowedCommands (issue #46)', () => {
    // allowedCommands: ['echo'] only — 'ls' is NOT in the list
    const tool = createBashTool({ allowedCommands: ['echo'] });

    it('blocks semicolon chaining: echo hi; ls /', async () => {
      // 'echo' is allowed but ';' lets 'ls' bypass the allowedCommands check
      const result = await tool.execute({ command: 'echo hi; ls /' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toMatch(/metachar|forbidden|not allowed/i);
    });

    it('blocks && chaining: echo hi && ls /', async () => {
      const result = await tool.execute({ command: 'echo hi && ls /' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
    });

    it('blocks pipe: echo hi | cat', async () => {
      const result = await tool.execute({ command: 'echo hi | cat' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
    });

    it('blocks backtick substitution: echo `whoami`', async () => {
      const result = await tool.execute({ command: 'echo `whoami`' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
    });

    it('blocks $() substitution: echo $(whoami)', async () => {
      const result = await tool.execute({ command: 'echo $(whoami)' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
    });

    it('still allows safe allowed commands without metacharacters', async () => {
      const result = await tool.execute({ command: 'echo hello' }, signal);
      const content = typeof result === 'string' ? result : result.content;
      expect(content).toContain('hello');
    });

    it('blocks metacharacters even when allowedCommands is not set (issue #140)', async () => {
      const unrestricted = createBashTool();
      const result = await unrestricted.execute({ command: 'echo line1 && echo line2' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toMatch(/metachar|forbidden/i);
    });
  });

  describe('metacharacter protection applies even without allowedCommands (issue #140)', () => {
    it('blocks ; injection without allowedCommands', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'echo hi; cat /etc/passwd' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toMatch(/metachar|forbidden/i);
    });

    it('blocks | injection without allowedCommands', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'echo hi | cat' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
    });

    it('blocks backtick injection without allowedCommands', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'echo `whoami`' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
    });

    it('still runs safe commands without metacharacters', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'echo safe' }, signal);
      const content = typeof result === 'string' ? result : result.content;
      expect(content).toContain('safe');
    });
  });

  describe('empty allowedCommands blocks all commands (#87)', () => {
    it('blocks any command when allowedCommands is empty array', async () => {
      const tool = createBashTool({ allowedCommands: [] });
      const result = await tool.execute({ command: 'echo hello' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toMatch(/no commands|empty allowedCommands|not permitted/i);
    });

    it('blocks destructive commands when allowedCommands is empty array', async () => {
      const tool = createBashTool({ allowedCommands: [] });
      const result = await tool.execute({ command: 'rm -rf /' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
    });

    it('still allows all commands when allowedCommands is undefined', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'echo unrestricted' }, signal);
      const content = typeof result === 'string' ? result : result.content;
      expect(content).toContain('unrestricted');
    });
  });

  describe('brace expansion blocked (issue #235)', () => {
    it('blocks { in command — brace expansion bypass', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'cat {/etc/passwd,/etc/hostname}' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toMatch(/metachar|forbidden/i);
    });

    it('blocks } in command', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'echo }' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toMatch(/metachar|forbidden/i);
    });

    it('blocks brace expansion even with allowedCommands set', async () => {
      const tool = createBashTool({ allowedCommands: ['git'] });
      const result = await tool.execute({ command: 'git {log,--exec-path}' }, signal);
      const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toMatch(/metachar|forbidden/i);
    });

    it('still allows commands without braces', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'echo hello' }, signal);
      const content = typeof result === 'string' ? result : result.content;
      expect(content).toContain('hello');
    });
  });

  describe('timeout parameter bounds (issue #9)', () => {
    it('should reject timeout=0 (would disable exec timeout)', async () => {
      const tool = createBashTool();
      // timeout=0 is interpreted by Node exec as "no timeout" — must be rejected
      await expect(tool.execute({ command: 'echo ok', timeout: 0 }, signal)).rejects.toThrow();
    });

    it('should reject negative timeout values', async () => {
      const tool = createBashTool();
      await expect(tool.execute({ command: 'echo ok', timeout: -1000 }, signal)).rejects.toThrow();
    });

    it('should reject timeout exceeding 300000ms (5 minutes)', async () => {
      const tool = createBashTool();
      await expect(
        tool.execute({ command: 'echo ok', timeout: 301_000 }, signal),
      ).rejects.toThrow();
    });

    it('should accept valid timeout within bounds', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'echo ok', timeout: 5000 }, signal);
      const content = typeof result === 'string' ? result : result.content;
      expect(content).toContain('ok');
    });
  });
});

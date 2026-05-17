import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveMemoryDir,
  validateMemoryPath,
  validateMemoryPathResolved,
  sanitizeFilename,
  ensureMemoryDir,
  isMemoryPath,
  validateThreadId,
} from '../../../src/memory/memory-paths.js';
import { sep, join } from 'node:path';
import { mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

describe('memory-paths', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('resolveMemoryDir', () => {
    it('should use config value when provided', () => {
      const result = resolveMemoryDir('/custom/memory/');
      expect(result).toContain('custom');
      expect(result).toContain('memory');
    });

    it('should use AGENT_MEMORY_DIR env var when no config', () => {
      process.env.AGENT_MEMORY_DIR = '/env/memory';
      const result = resolveMemoryDir();
      expect(result).toContain('env');
      expect(result).toContain('memory');
    });

    it('should use default when no config or env', () => {
      delete process.env.AGENT_MEMORY_DIR;
      const result = resolveMemoryDir();
      expect(result).toContain('.agentx');
      expect(result).toContain('memory');
      expect(result).toContain(process.cwd());
    });

    it('should expand tilde in path', () => {
      const result = resolveMemoryDir('~/my-memory');
      expect(result).not.toContain('~');
      expect(result).toContain('my-memory');
    });

    // Issue #271: AGENT_MEMORY_DIR should reject sensitive system paths
    it('should reject /etc via AGENT_MEMORY_DIR and fall back to default', () => {
      process.env.AGENT_MEMORY_DIR = '/etc';
      const result = resolveMemoryDir();
      expect(result).not.toContain('/etc');
      expect(result).toContain('.agentx');
    });

    it('should reject /proc via AGENT_MEMORY_DIR and fall back to default', () => {
      process.env.AGENT_MEMORY_DIR = '/proc';
      const result = resolveMemoryDir();
      expect(result).not.toContain('/proc');
      expect(result).toContain('.agentx');
    });

    it('should reject /sys via AGENT_MEMORY_DIR and fall back to default', () => {
      process.env.AGENT_MEMORY_DIR = '/sys';
      const result = resolveMemoryDir();
      expect(result).not.toContain('/sys');
      expect(result).toContain('.agentx');
    });

    it('should reject /dev via AGENT_MEMORY_DIR and fall back to default', () => {
      process.env.AGENT_MEMORY_DIR = '/dev';
      const result = resolveMemoryDir();
      expect(result).not.toContain('/dev');
      expect(result).toContain('.agentx');
    });

    it('should reject /bin via AGENT_MEMORY_DIR and fall back to default', () => {
      process.env.AGENT_MEMORY_DIR = '/bin';
      const result = resolveMemoryDir();
      expect(result).not.toContain('/bin');
      expect(result).toContain('.agentx');
    });

    it('should reject /tmp via AGENT_MEMORY_DIR and fall back to default', () => {
      process.env.AGENT_MEMORY_DIR = '/tmp';
      const result = resolveMemoryDir();
      expect(result).not.toContain('/tmp');
      expect(result).toContain('.agentx');
    });

    it('should still accept a valid absolute path via AGENT_MEMORY_DIR', () => {
      process.env.AGENT_MEMORY_DIR = '/home/user/projects/myapp/memory';
      const result = resolveMemoryDir();
      expect(result).toContain('myapp');
      expect(result).toContain('memory');
    });
  });

  describe('validateMemoryPath', () => {
    const memDir = '/home/user/.agent/memory/';

    it('should accept path within memory directory', () => {
      const result = validateMemoryPath('/home/user/.agent/memory/test.md', memDir);
      expect(result).toBeDefined();
    });

    it('should reject null bytes', () => {
      expect(validateMemoryPath('/home/user/.agent/memory/test\0.md', memDir)).toBeUndefined();
    });

    it('should reject empty string', () => {
      expect(validateMemoryPath('', memDir)).toBeUndefined();
    });

    it('should reject relative paths', () => {
      expect(validateMemoryPath('relative/path.md', memDir)).toBeUndefined();
    });

    it('should reject paths outside memory directory', () => {
      expect(validateMemoryPath('/etc/passwd', memDir)).toBeUndefined();
    });

    it('should reject root paths', () => {
      expect(validateMemoryPath('/', memDir)).toBeUndefined();
    });
  });

  describe('sanitizeFilename', () => {
    it('should convert to kebab-case with .md extension', () => {
      expect(sanitizeFilename('User Role')).toBe('user-role.md');
    });

    it('should strip unsafe characters', () => {
      expect(sanitizeFilename('test/../../../etc/passwd')).toBe('testetcpasswd.md');
    });

    it('should handle empty result', () => {
      expect(sanitizeFilename('!!!')).toBe('memory.md');
    });

    it('should truncate long names', () => {
      const long = 'a'.repeat(100);
      const result = sanitizeFilename(long);
      expect(result.length).toBeLessThanOrEqual(83); // 80 + .md
    });

    it('should not double .md extension', () => {
      expect(sanitizeFilename('test.md')).toBe('testmd.md');
    });

    it('should collapse multiple dashes', () => {
      expect(sanitizeFilename('test---name')).toBe('test-name.md');
    });

    it('should strip leading and trailing dashes', () => {
      expect(sanitizeFilename('-test-')).toBe('test.md');
    });
  });

  describe('isMemoryPath', () => {
    const memDir = '/home/user/.agent/memory/';

    it('should return true for path inside memory dir', () => {
      expect(isMemoryPath('/home/user/.agent/memory/test.md', memDir)).toBe(true);
    });

    it('should return true for nested path', () => {
      expect(isMemoryPath('/home/user/.agent/memory/sub/test.md', memDir)).toBe(true);
    });

    it('should return false for path outside memory dir', () => {
      expect(isMemoryPath('/home/user/.other/test.md', memDir)).toBe(false);
    });

    it('should handle path traversal attempts', () => {
      expect(isMemoryPath('/home/user/.agent/memory/../../../etc/passwd', memDir)).toBe(false);
    });
  });

  describe('ensureMemoryDir', () => {
    it('should be a function', () => {
      expect(typeof ensureMemoryDir).toBe('function');
    });
  });

  describe('validateMemoryPathResolved (#215)', () => {
    it('rejects a dangling symlink inside the memory dir', async () => {
      const memoryDir = join(tmpdir(), `agentx-test-215-${Date.now()}`);
      await mkdir(memoryDir, { recursive: true });
      const symlinkPath = join(memoryDir, 'evil.md');
      // Create a symlink whose target does not exist (dangling symlink)
      await symlink('/tmp/nonexistent-target-agentx-issue-215', symlinkPath);
      try {
        const result = await validateMemoryPathResolved(symlinkPath, memoryDir);
        expect(result).toBeUndefined();
      } finally {
        await rm(memoryDir, { recursive: true, force: true });
      }
    });

    it('returns cheap path for a genuinely nonexistent file (safe for creates)', async () => {
      const memoryDir = join(tmpdir(), `agentx-test-215-${Date.now()}`);
      await mkdir(memoryDir, { recursive: true });
      const nonexistent = join(memoryDir, 'new-file.md');
      try {
        const result = await validateMemoryPathResolved(nonexistent, memoryDir);
        expect(result).toBe(nonexistent);
      } finally {
        await rm(memoryDir, { recursive: true, force: true });
      }
    });
  });

  describe('validateThreadId', () => {
    it('accepts safe alphanumeric thread ids', () => {
      expect(validateThreadId('default')).toBe('default');
      expect(validateThreadId('thread-42')).toBe('thread-42');
      expect(validateThreadId('user_123')).toBe('user_123');
    });

    it('rejects thread ids with path traversal sequences', () => {
      expect(validateThreadId('../../../etc')).toBeUndefined();
      expect(validateThreadId('..')).toBeUndefined();
      expect(validateThreadId('foo/../bar')).toBeUndefined();
    });

    it('rejects thread ids containing path separators', () => {
      expect(validateThreadId('foo/bar')).toBeUndefined();
      expect(validateThreadId('foo\\bar')).toBeUndefined();
    });

    it('rejects thread ids with null bytes or control chars', () => {
      expect(validateThreadId('foo\0bar')).toBeUndefined();
      expect(validateThreadId('foo\nbar')).toBeUndefined();
    });

    it('rejects empty thread id', () => {
      expect(validateThreadId('')).toBeUndefined();
    });
  });
});

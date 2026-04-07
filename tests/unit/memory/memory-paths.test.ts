import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveMemoryDir,
  validateMemoryPath,
  sanitizeFilename,
  ensureMemoryDir,
  isMemoryPath,
} from '../../../src/memory/memory-paths.js';
import { sep } from 'node:path';

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
      expect(result).toContain('.agent');
      expect(result).toContain('memory');
    });

    it('should expand tilde in path', () => {
      const result = resolveMemoryDir('~/my-memory');
      expect(result).not.toContain('~');
      expect(result).toContain('my-memory');
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
});

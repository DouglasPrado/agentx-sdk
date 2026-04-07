import { describe, it, expect } from 'vitest';
import {
  MEMORY_TYPES,
  parseMemoryType,
  ENTRYPOINT_NAME,
  MAX_MEMORY_FILES,
  MAX_ENTRYPOINT_LINES,
  MAX_ENTRYPOINT_BYTES,
} from '../../../src/memory/memory-types.js';
import type { MemoryType, MemoryHeader, MemoryFile, SaveMemoryInput } from '../../../src/memory/memory-types.js';

describe('memory-types', () => {
  describe('MEMORY_TYPES', () => {
    it('should have exactly 4 types', () => {
      expect(MEMORY_TYPES).toHaveLength(4);
    });

    it('should contain user, feedback, project, reference', () => {
      expect(MEMORY_TYPES).toEqual(['user', 'feedback', 'project', 'reference']);
    });
  });

  describe('parseMemoryType', () => {
    it('should return valid type for known types', () => {
      expect(parseMemoryType('user')).toBe('user');
      expect(parseMemoryType('feedback')).toBe('feedback');
      expect(parseMemoryType('project')).toBe('project');
      expect(parseMemoryType('reference')).toBe('reference');
    });

    it('should return undefined for unknown type', () => {
      expect(parseMemoryType('unknown')).toBeUndefined();
      expect(parseMemoryType('memory')).toBeUndefined();
    });

    it('should return undefined for non-string input', () => {
      expect(parseMemoryType(null)).toBeUndefined();
      expect(parseMemoryType(undefined)).toBeUndefined();
      expect(parseMemoryType(42)).toBeUndefined();
      expect(parseMemoryType({})).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(parseMemoryType('')).toBeUndefined();
    });
  });

  describe('constants', () => {
    it('should have correct entrypoint name', () => {
      expect(ENTRYPOINT_NAME).toBe('MEMORY.md');
    });

    it('should have correct limits', () => {
      expect(MAX_MEMORY_FILES).toBe(200);
      expect(MAX_ENTRYPOINT_LINES).toBe(200);
      expect(MAX_ENTRYPOINT_BYTES).toBe(25_000);
    });
  });

  describe('type safety', () => {
    it('MemoryHeader should accept valid data', () => {
      const header: MemoryHeader = {
        filename: 'test.md',
        filePath: '/path/test.md',
        mtimeMs: Date.now(),
        name: 'Test',
        description: 'A test memory',
        type: 'user',
      };
      expect(header.type).toBe('user');
    });

    it('MemoryFile should extend MemoryHeader with content', () => {
      const file: MemoryFile = {
        filename: 'test.md',
        filePath: '/path/test.md',
        mtimeMs: Date.now(),
        name: 'Test',
        description: 'A test memory',
        type: 'feedback',
        content: 'Some content',
      };
      expect(file.content).toBe('Some content');
    });

    it('SaveMemoryInput should require all fields', () => {
      const input: SaveMemoryInput = {
        name: 'Test',
        description: 'A test',
        type: 'project',
        content: 'Content here',
      };
      expect(input.type).toBe('project');
    });
  });
});

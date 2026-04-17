import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseFrontmatter,
  scanMemoryFiles,
  formatMemoryManifest,
} from '../../../src/memory/memory-scanner.js';
import type { MemoryHeader } from '../../../src/memory/memory-types.js';

describe('memory-scanner', () => {
  describe('parseFrontmatter', () => {
    it('should parse valid frontmatter', () => {
      const content = `---
name: test memory
description: A test description
type: user
---

Some body content`;

      const result = parseFrontmatter(content);
      expect(result.name).toBe('test memory');
      expect(result.description).toBe('A test description');
      expect(result.type).toBe('user');
    });

    it('should return empty object for no frontmatter', () => {
      const result = parseFrontmatter('Just some text');
      expect(result).toEqual({});
    });

    it('should handle quoted values', () => {
      const content = `---
name: "quoted name"
description: 'single quoted'
type: feedback
---`;
      const result = parseFrontmatter(content);
      expect(result.name).toBe('quoted name');
      expect(result.description).toBe('single quoted');
    });

    it('should handle partial frontmatter', () => {
      const content = `---
name: only name
---`;
      const result = parseFrontmatter(content);
      expect(result.name).toBe('only name');
      expect(result.description).toBeUndefined();
      expect(result.type).toBeUndefined();
    });

    it('should ignore unknown keys', () => {
      const content = `---
name: test
unknown: value
type: project
---`;
      const result = parseFrontmatter(content);
      expect(result.name).toBe('test');
      expect(result.type).toBe('project');
      expect((result as Record<string, unknown>).unknown).toBeUndefined();
    });
  });

  describe('scanMemoryFiles', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'mem-test-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should return empty array for empty directory', async () => {
      const result = await scanMemoryFiles(tempDir);
      expect(result).toEqual([]);
    });

    it('should scan .md files and parse frontmatter', async () => {
      await writeFile(join(tempDir, 'test.md'), `---
name: Test Memory
description: A test
type: user
---

Content here`);

      const result = await scanMemoryFiles(tempDir);
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('test.md');
      expect(result[0].name).toBe('Test Memory');
      expect(result[0].description).toBe('A test');
      expect(result[0].type).toBe('user');
    });

    it('should exclude MEMORY.md', async () => {
      await writeFile(join(tempDir, 'MEMORY.md'), '# Index');
      await writeFile(join(tempDir, 'test.md'), '---\nname: test\n---\n');

      const result = await scanMemoryFiles(tempDir);
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('test.md');
    });

    it('should sort by mtime newest first', async () => {
      await writeFile(join(tempDir, 'old.md'), '---\nname: old\n---\n');
      // Wait a bit to ensure different mtime
      await new Promise(r => setTimeout(r, 50));
      await writeFile(join(tempDir, 'new.md'), '---\nname: new\n---\n');

      const result = await scanMemoryFiles(tempDir);
      expect(result).toHaveLength(2);
      expect(result[0].filename).toBe('new.md');
      expect(result[1].filename).toBe('old.md');
    });

    it('should scan nested directories', async () => {
      await mkdir(join(tempDir, 'sub'), { recursive: true });
      await writeFile(join(tempDir, 'sub', 'nested.md'), '---\nname: nested\n---\n');

      const result = await scanMemoryFiles(tempDir);
      expect(result).toHaveLength(1);
      expect(result[0].filename).toContain('nested.md');
    });

    it('should return empty array for non-existent directory', async () => {
      const result = await scanMemoryFiles('/nonexistent/dir');
      expect(result).toEqual([]);
    });

    it('should handle files without frontmatter gracefully', async () => {
      await writeFile(join(tempDir, 'nofm.md'), 'Just plain text');

      const result = await scanMemoryFiles(tempDir);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBeNull();
      expect(result[0].description).toBeNull();
      expect(result[0].type).toBeUndefined();
    });
  });

  describe('formatMemoryManifest', () => {
    it('should format memories with type, filename, timestamp, and description', () => {
      const memories: MemoryHeader[] = [
        {
          filename: 'test.md',
          filePath: '/path/test.md',
          mtimeMs: new Date('2026-01-15T10:00:00Z').getTime(),
          name: 'Test',
          description: 'A test memory',
          type: 'user',
        },
      ];

      const result = formatMemoryManifest(memories);
      expect(result).toContain('[user]');
      expect(result).toContain('test.md');
      expect(result).toContain('A test memory');
      expect(result).toContain('2026-01-15');
    });

    it('should handle memories without description', () => {
      const memories: MemoryHeader[] = [
        {
          filename: 'nodesc.md',
          filePath: '/path/nodesc.md',
          mtimeMs: Date.now(),
          name: 'No Desc',
          description: null,
          type: 'feedback',
        },
      ];

      const result = formatMemoryManifest(memories);
      expect(result).toContain('[feedback] nodesc.md');
      // No ": description" suffix — just type, filename, and timestamp
      expect(result).not.toMatch(/\): .+/);
    });

    it('should handle memories without type', () => {
      const memories: MemoryHeader[] = [
        {
          filename: 'notype.md',
          filePath: '/path/notype.md',
          mtimeMs: Date.now(),
          name: 'No Type',
          description: 'desc',
          type: undefined,
        },
      ];

      const result = formatMemoryManifest(memories);
      expect(result).toMatch(/^- notype\.md/);
    });

    it('should return empty string for empty array', () => {
      expect(formatMemoryManifest([])).toBe('');
    });
  });

  describe('scanMemoryFiles — AbortSignal', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'scanner-abort-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should return empty array when signal is already aborted before readdir', async () => {
      const controller = new AbortController();
      controller.abort();
      const result = await scanMemoryFiles(tempDir, controller.signal);
      expect(result).toEqual([]);
    });
  });
});

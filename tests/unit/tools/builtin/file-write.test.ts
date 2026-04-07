import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFileWriteTool } from '../../../../src/tools/builtin/file-write.js';

describe('builtin/file-write', () => {
  let tempDir: string;
  const signal = new AbortController().signal;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'fwrite-tool-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should return AgentTool with correct metadata', () => {
    const tool = createFileWriteTool();
    expect(tool.name).toBe('Write');
    expect(tool.isDestructive).toBe(true);
    expect(tool.getFilePath).toBeDefined();
  });

  it('should write a new file', async () => {
    const tool = createFileWriteTool();
    const filePath = join(tempDir, 'new.txt');
    await tool.execute({ file_path: filePath, content: 'Hello world' }, signal);

    const written = await readFile(filePath, 'utf-8');
    expect(written).toBe('Hello world');
  });

  it('should create parent directories', async () => {
    const tool = createFileWriteTool();
    const filePath = join(tempDir, 'deep', 'nested', 'file.txt');
    await tool.execute({ file_path: filePath, content: 'nested content' }, signal);

    const written = await readFile(filePath, 'utf-8');
    expect(written).toBe('nested content');
  });

  it('should overwrite existing file', async () => {
    const tool = createFileWriteTool();
    const filePath = join(tempDir, 'existing.txt');
    await tool.execute({ file_path: filePath, content: 'first' }, signal);
    await tool.execute({ file_path: filePath, content: 'second' }, signal);

    const written = await readFile(filePath, 'utf-8');
    expect(written).toBe('second');
  });

  it('should return bytes written', async () => {
    const tool = createFileWriteTool();
    const result = await tool.execute({ file_path: join(tempDir, 'a.txt'), content: 'abc' }, signal);
    const content = typeof result === 'string' ? result : result.content;
    expect(content).toContain('3 bytes');
  });
});

/**
 * Memory tools for the forked extraction agent.
 *
 * These tools give the extraction subagent the ability to read, write,
 * edit, and delete memory files — just like old_src's forked agent had
 * FileRead/FileEdit/FileWrite restricted to the memory directory.
 *
 * All tools are path-constrained: they only operate within the resolved
 * memory directory (global or thread-scoped).
 */

import { z } from 'zod';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { AgentTool } from '../contracts/entities/agent-tool.js';
import { ENTRYPOINT_NAME } from './memory-types.js';
import { scanMemoryFiles, formatMemoryManifest, parseFrontmatter } from './memory-scanner.js';
import { sanitizeFilename, sanitizeFrontmatterValue, validateMemoryPath, validateMemoryPathResolved, validateThreadId } from './memory-paths.js';

const THREADS_DIR = 'threads';

/**
 * Per-directory promise-chain mutex for index writes. Multiple concurrent
 * memory_write calls must not interleave reads and writes on MEMORY.md.
 */
const indexLocks = new Map<string, Promise<void>>();

async function withIndexLock<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prev = indexLocks.get(dir) ?? Promise.resolve();
  const result = prev.then(() => fn());
  const tail = result.then(() => {}, () => {});
  indexLocks.set(dir, tail);
  // Opportunistically drop completed locks so the Map doesn't grow unbounded
  void tail.finally(() => {
    if (indexLocks.get(dir) === tail) indexLocks.delete(dir);
  });
  return result;
}

/**
 * Resolve the effective directory for memory operations.
 */
function resolveDir(memoryDir: string, threadId?: string): string {
  if (!threadId) return memoryDir;
  const safeId = validateThreadId(threadId);
  if (!safeId) throw new Error(`Invalid threadId: ${JSON.stringify(threadId)}`);
  return join(memoryDir, THREADS_DIR, safeId);
}

/**
 * Validate a filename: must be .md, not MEMORY.md, no path traversal.
 */
function validateFilename(filename: string): string | null {
  if (!filename || filename.includes('\0')) return 'Invalid filename';
  if (/[\r\n\t]/.test(filename)) return 'Filename contains invalid whitespace characters';
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return 'Path traversal not allowed';
  }
  if (basename(filename) === ENTRYPOINT_NAME) return 'Cannot access MEMORY.md directly — it is managed automatically';
  if (!filename.endsWith('.md')) return 'Filename must end with .md';
  return null;
}

/**
 * Create memory tools scoped to a specific directory (global or thread).
 */
export function createMemoryTools(memoryDir: string, threadId?: string): AgentTool[] {
  const dir = resolveDir(memoryDir, threadId);

  /** Defense-in-depth: ensure the resolved path stays inside memoryDir (sync, shallow). */
  const safeJoin = (filename: string): string | null => {
    const candidate = join(dir, filename);
    return validateMemoryPath(candidate, memoryDir) ?? null;
  };

  /** Like safeJoin, but resolves symlinks via realpath to prevent symlink escape. */
  const safeJoinResolved = async (filename: string): Promise<string | null> => {
    const candidate = join(dir, filename);
    return (await validateMemoryPathResolved(candidate, memoryDir)) ?? null;
  };

  const memoryList: AgentTool = {
    name: 'memory_list',
    description: 'List all existing memory files with their name, type, description, and last modified date. Use this FIRST to see what memories already exist before creating new ones.',
    parameters: z.object({}),
    isConcurrencySafe: true,
    isReadOnly: true,
    execute: async () => {
      const memories = await scanMemoryFiles(dir);
      if (memories.length === 0) return 'No memory files found.';
      return formatMemoryManifest(memories);
    },
  };

  const memoryRead: AgentTool = {
    name: 'memory_read',
    description: 'Read the full content of a memory file by filename. Use this to check existing memory content before deciding to update or skip.',
    parameters: z.object({
      filename: z.string().describe('The filename to read (e.g. "user-role.md")'),
    }),
    isConcurrencySafe: true,
    isReadOnly: true,
    execute: async (rawArgs) => {
      const { filename } = rawArgs as { filename: string };
      const err = validateFilename(filename);
      if (err) return { content: err, isError: true };

      const safePath = await safeJoinResolved(filename);
      if (!safePath) return { content: 'Invalid path', isError: true };

      try {
        const content = await readFile(safePath, 'utf-8');
        return content;
      } catch {
        return { content: `File not found: ${filename}`, isError: true };
      }
    },
  };

  const memoryWrite: AgentTool = {
    name: 'memory_write',
    description: 'Create a NEW memory file. Only use this when no existing memory covers this topic — otherwise use memory_edit to update the existing file.',
    parameters: z.object({
      name: z.string().describe('Short name for the memory (2-4 words)'),
      description: z.string().describe('One-line description for indexing'),
      type: z.enum(['user', 'feedback', 'project', 'reference']).describe('Memory type'),
      content: z.string().describe('The memory content (markdown)'),
    }),
    execute: async (rawArgs) => {
      const args = rawArgs as { name: string; description: string; type: string; content: string };
      const filename = sanitizeFilename(args.name);

      await mkdir(dir, { recursive: true });
      const safePath = safeJoin(filename);
      if (!safePath) return { content: 'Invalid path', isError: true };

      const fileContent = [
        '---',
        `name: ${sanitizeFrontmatterValue(args.name)}`,
        `description: ${sanitizeFrontmatterValue(args.description)}`,
        `type: ${args.type}`,
        '---',
        '',
        args.content,
        '',
      ].join('\n');

      await writeFile(safePath, fileContent, 'utf-8');
      await addToIndex(dir, filename, args.description);
      return `Memory saved: ${filename}`;
    },
  };

  const memoryEdit: AgentTool = {
    name: 'memory_edit',
    description: 'Update an existing memory file. Preserves the filename and type. Use this instead of memory_write when the memory already exists.',
    parameters: z.object({
      filename: z.string().describe('The filename to edit (e.g. "user-role.md")'),
      content: z.string().describe('The new content (replaces existing body)'),
      name: z.string().optional().describe('Updated name (optional)'),
      description: z.string().optional().describe('Updated description (optional)'),
    }),
    execute: async (rawArgs) => {
      const args = rawArgs as { filename: string; content: string; name?: string; description?: string };
      const err = validateFilename(args.filename);
      if (err) return { content: err, isError: true };

      const filePath = await safeJoinResolved(args.filename);
      if (!filePath) return { content: 'Invalid path', isError: true };

      // Read existing to preserve frontmatter fields
      let existingContent: string;
      try {
        existingContent = await readFile(filePath, 'utf-8');
      } catch {
        return { content: `File not found: ${args.filename}`, isError: true };
      }

      const frontmatter = parseFrontmatter(existingContent);
      const name = args.name ?? frontmatter.name ?? args.filename.replace('.md', '');
      const description = args.description ?? frontmatter.description ?? '';
      const type = frontmatter.type ?? 'user';

      const fileContent = [
        '---',
        `name: ${sanitizeFrontmatterValue(name)}`,
        `description: ${sanitizeFrontmatterValue(description)}`,
        `type: ${type}`,
        '---',
        '',
        args.content,
        '',
      ].join('\n');

      await writeFile(filePath, fileContent, 'utf-8');
      return `Memory updated: ${args.filename}`;
    },
  };

  const memoryDelete: AgentTool = {
    name: 'memory_delete',
    description: 'Delete a memory file and remove it from the index. Use when a memory is outdated or wrong.',
    parameters: z.object({
      filename: z.string().describe('The filename to delete (e.g. "old-info.md")'),
    }),
    isDestructive: true,
    execute: async (rawArgs) => {
      const { filename } = rawArgs as { filename: string };
      const err = validateFilename(filename);
      if (err) return { content: err, isError: true };

      const safePath = await safeJoinResolved(filename);
      if (!safePath) return { content: 'Invalid path', isError: true };

      try {
        await unlink(safePath);
      } catch {
        return { content: `File not found: ${filename}`, isError: true };
      }

      await removeFromIndex(dir, filename);
      return `Memory deleted: ${filename}`;
    },
  };

  return [memoryList, memoryRead, memoryWrite, memoryEdit, memoryDelete];
}

// --- Index helpers (mirror FileMemorySystem's private methods) ---

async function addToIndex(dir: string, filename: string, description: string): Promise<void> {
  await withIndexLock(dir, async () => {
    const entrypoint = join(dir, ENTRYPOINT_NAME);
    let existing = '';
    try {
      existing = await readFile(entrypoint, 'utf-8');
    } catch { /* File doesn't exist yet */ }

    if (existing.includes(`(${filename})`)) return;

    const safeDesc = sanitizeFrontmatterValue(description);
    const newEntry = `- [${safeDesc}](${filename}) — ${safeDesc}`;
    const updated = existing ? `${existing.trimEnd()}\n${newEntry}\n` : `${newEntry}\n`;
    try {
      await writeFile(entrypoint, updated, 'utf-8');
    } catch { /* index update is non-critical — ignore I/O failures */ }
  });
}

async function removeFromIndex(dir: string, filename: string): Promise<void> {
  await withIndexLock(dir, async () => {
    const entrypoint = join(dir, ENTRYPOINT_NAME);
    try {
      const content = await readFile(entrypoint, 'utf-8');
      const lines = content.split('\n').filter(line => !line.includes(`(${filename})`));
      await writeFile(entrypoint, lines.join('\n'), 'utf-8');
    } catch { /* Index doesn't exist */ }
  });
}

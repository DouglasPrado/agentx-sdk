import { readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { z } from 'zod';
import type { AgentTool } from '../../contracts/entities/agent-tool.js';
import { matchGlob } from '../../skills/skill-glob.js';
import { assertSafePath } from './path-guard.js';

const MAX_RESULTS = 100;

const GlobParams = z.object({
  pattern: z.string().describe('Glob pattern to match (e.g. "**/*.ts", "src/*.js")'),
  path: z.string().optional().describe('Directory to search in. Defaults to cwd.'),
});

async function walkDir(dir: string, results: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(full, results);
    } else {
      results.push(full);
    }
  }
}

export function createGlobTool(workingDir?: string): AgentTool {
  return {
    name: 'Glob',
    description: 'Fast file pattern matching. Returns matching file paths sorted by modification time.',
    parameters: GlobParams,
    isConcurrencySafe: true,
    isReadOnly: true,

    async execute(rawArgs: unknown, _signal: AbortSignal) {
      const { pattern, path: searchPath } = rawArgs as z.infer<typeof GlobParams>;

      if (workingDir && searchPath) {
        try {
          assertSafePath(searchPath, workingDir);
        } catch (error) {
          return { content: (error as Error).message, isError: true };
        }
      }

      const baseDir = searchPath || workingDir || process.cwd();

      const allFiles: string[] = [];
      try {
        await walkDir(baseDir, allFiles);
      } catch {
        return { content: `Cannot read directory: ${baseDir}`, isError: true };
      }

      // Match against pattern (relative paths). Use path.relative + posix-style
      // separators so `/home/user` does not prefix-match `/home/username`.
      const matched = allFiles.filter(f => {
        const rel = relative(baseDir, f);
        if (rel.startsWith('..') || rel === '') return false;
        const posix = sep === '/' ? rel : rel.split(sep).join('/');
        return matchGlob(pattern, posix);
      });

      if (matched.length === 0) {
        return `No files found matching "${pattern}" in ${baseDir}`;
      }

      // Sort by mtime (newest first)
      const withStats = await Promise.all(
        matched.slice(0, MAX_RESULTS * 2).map(async f => {
          try {
            const s = await stat(f);
            return { path: f, mtimeMs: s.mtimeMs };
          } catch {
            return { path: f, mtimeMs: 0 };
          }
        }),
      );
      withStats.sort((a, b) => b.mtimeMs - a.mtimeMs);

      const limited = withStats.slice(0, MAX_RESULTS);
      const lines = limited.map(f => f.path);
      const truncated = matched.length > MAX_RESULTS;

      return lines.join('\n') + (truncated ? `\n\n[${matched.length - MAX_RESULTS} more files not shown]` : '');
    },
  };
}

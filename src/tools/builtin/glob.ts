import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { AgentTool } from '../../contracts/entities/agent-tool.js';
import { matchGlob } from '../../skills/skill-glob.js';

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

export function createGlobTool(): AgentTool {
  return {
    name: 'Glob',
    description: 'Fast file pattern matching. Returns matching file paths sorted by modification time.',
    parameters: GlobParams,
    isConcurrencySafe: true,
    isReadOnly: true,

    async execute(rawArgs: unknown, _signal: AbortSignal) {
      const { pattern, path: searchPath } = rawArgs as z.infer<typeof GlobParams>;
      const baseDir = searchPath || process.cwd();

      const allFiles: string[] = [];
      try {
        await walkDir(baseDir, allFiles);
      } catch {
        return { content: `Cannot read directory: ${baseDir}`, isError: true };
      }

      // Match against pattern (relative paths)
      const matched = allFiles.filter(f => {
        const relative = f.slice(baseDir.length + 1);
        return matchGlob(pattern, relative);
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

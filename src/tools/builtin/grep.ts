import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { AgentTool } from '../../contracts/entities/agent-tool.js';
import { matchGlob } from '../../skills/skill-glob.js';

const DEFAULT_MAX_RESULTS = 50;

const GrepParams = z.object({
  pattern: z.string().describe('Regex pattern to search for'),
  path: z.string().optional().describe('Directory to search in. Defaults to cwd.'),
  glob: z.string().optional().describe('Glob pattern to filter files (e.g. "*.ts")'),
  max_results: z.number().optional().describe('Max matching lines to return. Default: 50.'),
});

async function collectFiles(dir: string, globPattern?: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(d: string): Promise<void> {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        if (globPattern) {
          const relative = full.slice(dir.length + 1);
          if (!matchGlob(globPattern, relative) && !matchGlob(globPattern, entry.name)) continue;
        }
        results.push(full);
      }
    }
  }
  await walk(dir);
  return results;
}

export function createGrepTool(): AgentTool {
  return {
    name: 'Grep',
    description: 'Search file contents using regex. Returns matching lines with file paths and line numbers.',
    parameters: GrepParams,
    isConcurrencySafe: true,
    isReadOnly: true,

    async execute(rawArgs: unknown, signal: AbortSignal) {
      const { pattern, path: searchPath, glob: globFilter, max_results } = rawArgs as z.infer<typeof GrepParams>;
      const baseDir = searchPath || process.cwd();
      const maxResults = max_results ?? DEFAULT_MAX_RESULTS;

      let regex: RegExp;
      try {
        regex = new RegExp(pattern, 'g');
      } catch (e) {
        return { content: `Invalid regex: ${String(e)}`, isError: true };
      }

      const files = await collectFiles(baseDir, globFilter);
      const matches: string[] = [];

      for (const file of files) {
        if (matches.length >= maxResults) break;
        if (signal.aborted) break;

        try {
          const s = await stat(file);
          if (s.size > 1_000_000) continue; // skip files > 1MB

          const content = await readFile(file, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (matches.length >= maxResults) break;
            regex.lastIndex = 0;
            if (regex.test(lines[i]!)) {
              const relative = file.slice(baseDir.length + 1) || file;
              matches.push(`${relative}:${i + 1}:${lines[i]}`);
            }
          }
        } catch {
          // Skip unreadable files
        }
      }

      if (matches.length === 0) {
        return `No matches found for "${pattern}" in ${baseDir}`;
      }

      return matches.join('\n');
    },
  };
}

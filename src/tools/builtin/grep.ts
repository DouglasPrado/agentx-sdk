import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { AgentTool } from '../../contracts/entities/agent-tool.js';
import { matchGlob } from '../../skills/skill-glob.js';
import { resolveSearchDir } from './path-guard.js';

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
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
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

export function createGrepTool(workingDir?: string): AgentTool {
  return {
    name: 'Grep',
    description:
      'Search file contents using regex. Returns matching lines with file paths and line numbers.',
    parameters: GrepParams,
    isConcurrencySafe: true,
    isReadOnly: true,

    async execute(rawArgs: unknown, signal: AbortSignal) {
      const {
        pattern,
        path: searchPath,
        glob: globFilter,
        max_results,
      } = rawArgs as z.infer<typeof GrepParams>;

      let baseDir: string;
      try {
        baseDir = resolveSearchDir(searchPath, workingDir);
      } catch (error) {
        return { content: (error as Error).message, isError: true };
      }
      const maxResults = max_results ?? DEFAULT_MAX_RESULTS;

      // Cap pattern length up front. Acts as a length-bound barrier for the
      // REDOS_RISK regex below: without it, a pathological input like many '('
      // would itself cause polynomial backtracking inside the detector.
      if (pattern.length > 1000) {
        return { content: 'Pattern too long — max 1000 chars', isError: true };
      }

      // Reject patterns that can cause catastrophic backtracking (ReDoS).
      // Catches: groups with internal quantifier AND external quantifier (a+)+,
      // consecutive quantifiers a+*, quantified character classes [a-z]*,
      // and alternation groups with external quantifier (a|ab)*.
      // Uses [^)]{0,500} (bounded) instead of [^)]* to keep the detector itself
      // free of polynomial backtracking on adversarial input. .* would also
      // false-positive on safe patterns like (func\w+)\s*\( — see issue #145.
      const REDOS_RISK =
        /\([^)]{0,500}[+*?][^)]{0,500}\)[+*?]|\([^)]{0,500}[+*?][^)]{0,500}\)\{|[+*?]{2,}|\[\^?[^\]]{0,500}\][*+]|\([^)]{0,500}\|[^)]{0,500}\)[+*?{]/;
      if (REDOS_RISK.test(pattern)) {
        return { content: 'Pattern too complex — potential ReDoS risk', isError: true };
      }

      let regex: RegExp;
      try {
        regex = new RegExp(pattern, 'g');
      } catch (e) {
        return { content: `Invalid regex: ${String(e)}`, isError: true };
      }

      // ReDoS defense: cap per-line length so pathological patterns
      // (e.g. `(a+)+b` on long runs) can't hang the tool. Matching lines
      // longer than this is rare in practice for source-code grep.
      const MAX_LINE_LENGTH = 10_000;

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
            const line = lines[i]!;
            if (line.length > MAX_LINE_LENGTH) continue;
            regex.lastIndex = 0;
            if (regex.test(line)) {
              const relative = file.slice(baseDir.length + 1) || file;
              matches.push(`${relative}:${i + 1}:${line}`);
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

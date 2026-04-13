/**
 * Memory directory path resolution and security validation.
 *
 * Security model ported from old_src/memdir/paths.ts:
 * - Rejects relative paths, root/near-root, Windows drive roots, UNC paths, null bytes
 * - Tilde expansion only from config (~/), not from bare ~ or ~/. or ~/..
 * - All paths normalized to NFC to prevent Unicode normalization attacks
 */

import { homedir } from 'node:os';
import { isAbsolute, join, normalize, sep } from 'node:path';
import { mkdir } from 'node:fs/promises';

/**
 * Default memory directory: `<cwd>/.agentx/memory/`.
 * Computed dynamically because `process.cwd()` can change across tests.
 */
export function getDefaultMemoryDir(): string {
  const path = join(process.cwd(), '.agentx', 'memory');
  return (path + sep).normalize('NFC');
}

/**
 * Resolve the memory directory from config, env var, or default.
 * Priority: config.memoryDir → AGENT_MEMORY_DIR env → <cwd>/.agentx/memory/
 *
 * Config paths support ~/ expansion (user-friendly).
 * Env var paths must be absolute (set programmatically).
 */
export function resolveMemoryDir(memoryDir?: string): string {
  // Env var: no tilde expansion (must be absolute)
  if (!memoryDir && process.env.AGENT_MEMORY_DIR) {
    const envPath = process.env.AGENT_MEMORY_DIR;
    const normalized = normalize(envPath).replace(/[/\\]+$/, '');
    if (isAbsolute(normalized) && normalized.length >= 3) {
      return (normalized + sep).normalize('NFC');
    }
  }

  if (!memoryDir) return getDefaultMemoryDir();
  return expandAndNormalize(memoryDir);
}

/**
 * Expand ~ and normalize a path. Returns absolute path with trailing separator.
 * Only expands ~/ and ~\ (not bare ~, ~/., ~/..)
 */
function expandAndNormalize(raw: string): string {
  let candidate = raw;

  if (candidate.startsWith('~/') || candidate.startsWith('~\\')) {
    const rest = candidate.slice(2);
    // Reject trivial remainders that would expand to $HOME or an ancestor
    const restNorm = normalize(rest || '.');
    if (restNorm === '.' || restNorm === '..') {
      // Fall through to default — don't expand dangerous paths
      candidate = join(process.cwd(), '.agentx', 'memory');
    } else {
      candidate = join(homedir(), rest);
    }
  }

  const normalized = normalize(candidate).replace(/[/\\]+$/, '');
  return (normalized + sep).normalize('NFC');
}

/**
 * Validate that a path is safely within the memory directory.
 *
 * SECURITY: Rejects paths that would be dangerous:
 * - Empty or contains null bytes (truncation in syscalls)
 * - Relative paths (!isAbsolute)
 * - Root/near-root (length < 3)
 * - Windows drive-root (C:)
 * - UNC paths (\\server\share or //server/share)
 * - URL-encoded traversal (%2e%2e)
 * - Outside memory directory after normalization
 *
 * Returns the normalized path if valid, undefined if rejected.
 */
export function validateMemoryPath(
  path: string,
  memoryDir: string,
): string | undefined {
  if (!path || path.includes('\0')) return undefined;

  // Reject URL-encoded path traversal
  if (path.includes('%2e') || path.includes('%2E') || path.includes('%2f') || path.includes('%2F')) {
    return undefined;
  }

  const normalized = normalize(path).normalize('NFC');
  if (!isAbsolute(normalized)) return undefined;
  if (normalized.length < 3) return undefined;

  // Reject Windows drive roots and UNC paths
  if (/^[A-Za-z]:$/.test(normalized)) return undefined;
  if (normalized.startsWith('\\\\') || normalized.startsWith('//')) return undefined;

  // Must be within memory directory (containment check)
  const normalizedDir = normalize(memoryDir).replace(/[/\\]+$/, '').normalize('NFC') + sep;
  if (!normalized.startsWith(normalizedDir)) return undefined;

  return normalized;
}

/**
 * Sanitize a name into a safe kebab-case filename with .md extension.
 */
export function sanitizeFilename(name: string): string {
  const sanitized = name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  if (!sanitized) return 'memory.md';
  return sanitized.endsWith('.md') ? sanitized : `${sanitized}.md`;
}

/**
 * Idempotent memory directory creation.
 */
export async function ensureMemoryDir(memoryDir: string): Promise<void> {
  await mkdir(memoryDir, { recursive: true });
}

/**
 * Check if an absolute path is within the memory directory.
 * Uses NFC normalization to prevent Unicode-based path traversal.
 */
export function isMemoryPath(absolutePath: string, memoryDir: string): boolean {
  const normalizedPath = normalize(absolutePath).normalize('NFC');
  const normalizedDir = normalize(memoryDir).replace(/[/\\]+$/, '').normalize('NFC') + sep;
  return normalizedPath.startsWith(normalizedDir);
}

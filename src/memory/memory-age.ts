/**
 * Memory staleness tracking.
 *
 * Models are poor at date arithmetic — a raw ISO timestamp doesn't trigger
 * staleness reasoning the way "47 days ago" does.
 */

/**
 * Days elapsed since mtime. Floor-rounded — 0 for today, 1 for yesterday.
 * Negative inputs (future mtime, clock skew) clamp to 0.
 */
export function memoryAgeDays(mtimeMs: number): number {
  return Math.max(0, Math.floor((Date.now() - mtimeMs) / 86_400_000));
}

/** Human-readable age string. */
export function memoryAge(mtimeMs: number): string {
  const d = memoryAgeDays(mtimeMs);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

/**
 * Staleness caveat for memories >1 day old. Returns '' for fresh memories.
 */
export function memoryFreshnessText(mtimeMs: number): string {
  const d = memoryAgeDays(mtimeMs);
  if (d <= 1) return '';
  return (
    `This memory is ${d} days old. ` +
    `Memories are point-in-time observations, not live state — ` +
    `claims about code behavior or file citations may be outdated. ` +
    `Verify against current code before asserting as fact.`
  );
}

/**
 * Per-memory staleness note. Returns '' for memories ≤ 1 day old.
 */
export function memoryFreshnessNote(mtimeMs: number): string {
  const text = memoryFreshnessText(mtimeMs);
  if (!text) return '';
  return `[staleness warning] ${text}\n`;
}

/**
 * Minimal glob matcher — supports *, **, and ? patterns.
 * No external dependencies. Converts globs to regex internally.
 */

/**
 * Convert a glob pattern to a RegExp.
 *
 * Supported syntax:
 * - `*`   matches any characters except `/`
 * - `**`  matches any characters including `/` (recursive)
 * - `?`   matches exactly one character except `/`
 * - All other characters are escaped for literal matching.
 */
export function globToRegex(pattern: string): RegExp {
  let regex = '';
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i]!;

    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        // ** — match anything including path separators
        // Skip optional trailing /
        i += 2;
        if (pattern[i] === '/') i++;
        regex += '.*';
      } else {
        // * — match anything except /
        regex += '[^/]*';
        i++;
      }
    } else if (ch === '?') {
      regex += '[^/]';
      i++;
    } else {
      // Escape regex special characters
      regex += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
      i++;
    }
  }

  return new RegExp(`^${regex}$`);
}

/**
 * Test if a file path matches a glob pattern.
 * Both pattern and path use forward slashes.
 */
export function matchGlob(pattern: string, filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return globToRegex(pattern).test(normalized);
}

/**
 * Test if a file path matches any of the given glob patterns.
 */
export function matchAnyGlob(patterns: string[], filePath: string): boolean {
  return patterns.some(p => matchGlob(p, filePath));
}

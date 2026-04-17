/**
 * Argument substitution engine for skill prompts.
 *
 * Supports:
 * - $argName → positional argument value (based on argNames array)
 * - ${VARIABLE} → variable from the variables map
 * - Unmatched placeholders are left as-is (no silent removal)
 */

/**
 * Split raw argument string into positional tokens.
 * Respects quoted strings (single and double quotes).
 */
export function splitArgs(raw: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (const ch of raw) {
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

/**
 * Substitute argument placeholders in skill content.
 *
 * @param content  — the skill prompt template
 * @param rawArgs  — raw argument string from user (e.g. "file.ts production")
 * @param argNames — named placeholders (e.g. ["file", "env"])
 * @param variables — additional variables (e.g. { SKILL_DIR: "/path", THREAD_ID: "t1" })
 */
export function substituteArgs(
  content: string,
  rawArgs: string,
  argNames?: string[],
  variables?: Record<string, string>,
): string {
  let result = content;

  // 1. Named positional arguments: $argName
  if (argNames && argNames.length > 0) {
    const tokens = splitArgs(rawArgs);
    for (let i = 0; i < argNames.length; i++) {
      const name = argNames[i]!;
      const value = tokens[i] ?? '';
      // Replace $argName (word boundary aware — don't replace $argNameExtra).
      // Use a function replacer so special sequences in the value (e.g. $&, $1)
      // are treated as literals, not as backreferences.
      result = result.replace(new RegExp(`\\$${name}(?![a-zA-Z0-9_])`, 'g'), () => value);
    }

    // Also make remaining args available as $ARGS (everything after named args)
    const remaining = tokens.slice(argNames.length).join(' ');
    result = result.replace(/\$ARGS(?![a-zA-Z0-9_])/g, () => remaining);
  }

  // 2. Variable substitution: ${VARIABLE}
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\$\\{${escapeRegex(key)}\\}`, 'g'), () => value);
    }
  }

  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

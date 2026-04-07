/**
 * Prompt builders for tool usage guidance and environment info.
 *
 * These generate cognitive scaffolding that helps the LLM use tools
 * effectively. Ported from old_src/constants/prompts.ts patterns,
 * adapted for SDK context.
 */

import type { AgentTool } from '../contracts/entities/agent-tool.js';

// ---------------------------------------------------------------------------
// Tool usage prompt
// ---------------------------------------------------------------------------

/**
 * Build intelligent tool usage instructions for the model.
 * Goes beyond a simple list — teaches the model WHEN and HOW to use tools,
 * how to handle errors, and how to combine tools effectively.
 */
export function buildToolUsagePrompt(tools: AgentTool[]): string {
  if (tools.length === 0) return '';

  const lines: string[] = [
    '# Available Tools',
    '',
    'You have access to the following tools. Use them proactively when the user asks for data, actions, or analysis — do not describe what you would do, just do it.',
    '',
  ];

  // Categorize tools
  const destructive: AgentTool[] = [];

  for (const tool of tools) {
    const dest = typeof tool.isDestructive === 'function' ? false : tool.isDestructive === true;
    if (dest) destructive.push(tool);
  }

  // List all tools with descriptions
  for (const tool of tools) {
    lines.push(`- **${tool.name}**: ${tool.description}`);
  }

  lines.push('');
  lines.push('## Tool Usage Guidelines');
  lines.push('');
  lines.push('- Call tools when you need data or need to perform actions — do not guess or make up answers when a tool can provide the real answer.');
  lines.push('- If multiple independent pieces of information are needed, call multiple tools in parallel for efficiency.');
  lines.push('- If one tool call depends on the result of another, call them sequentially.');
  lines.push('- When a tool returns an error, analyze the error message and adjust your approach — do not retry the exact same call blindly.');

  // Safety guidance for destructive tools
  if (destructive.length > 0) {
    lines.push('');
    lines.push('## Caution: Destructive Tools');
    lines.push('');
    lines.push('The following tools perform irreversible operations. Use them carefully:');
    for (const tool of destructive) {
      lines.push(`- **${tool.name}** — confirm with the user before performing destructive actions unless explicitly instructed.`);
    }
  }

  // Concurrency hints
  const safeConcurrent = tools.filter(t =>
    typeof t.isConcurrencySafe === 'function' ? false : t.isConcurrencySafe === true,
  );
  if (safeConcurrent.length > 0 && safeConcurrent.length < tools.length) {
    lines.push('');
    lines.push('## Concurrency');
    lines.push('');
    lines.push(`The following tools are safe to call in parallel: ${safeConcurrent.map(t => t.name).join(', ')}. Other tools should be called one at a time.`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Environment info prompt
// ---------------------------------------------------------------------------

export interface EnvironmentInfo {
  /** Current working directory */
  cwd?: string;
  /** Operating system platform */
  platform?: string;
  /** Model being used */
  model?: string;
  /** Current date (ISO format) */
  date?: string;
  /** Whether this is a git repository */
  isGitRepo?: boolean;
  /** Git branch */
  gitBranch?: string;
  /** Additional custom context entries */
  custom?: Record<string, string>;
}

/**
 * Build environment information prompt for the model.
 * Gives the LLM awareness of its execution context.
 */
export function buildEnvironmentPrompt(info: EnvironmentInfo): string {
  const lines: string[] = ['# Environment'];

  if (info.cwd) lines.push(`- Working directory: \`${info.cwd}\``);
  if (info.platform) lines.push(`- Platform: ${info.platform}`);
  if (info.model) lines.push(`- Model: ${info.model}`);
  if (info.date) lines.push(`- Date: ${info.date}`);
  if (info.isGitRepo !== undefined) {
    lines.push(`- Git repository: ${info.isGitRepo ? 'yes' : 'no'}`);
    if (info.gitBranch) lines.push(`- Branch: ${info.gitBranch}`);
  }

  if (info.custom) {
    for (const [key, value] of Object.entries(info.custom)) {
      lines.push(`- ${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

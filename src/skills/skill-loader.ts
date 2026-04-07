/**
 * File-based skill loader — scans directories for SKILL.md files.
 *
 * Mirrors the memory-scanner pattern: read .md files with YAML frontmatter,
 * parse metadata, return typed AgentSkill objects.
 *
 * Supported directory layouts:
 *   skillsDir/skill-name/SKILL.md     (preferred — each skill in its own folder)
 *   skillsDir/skill-name.md           (flat — single file per skill)
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import type { AgentSkill } from '../contracts/entities/agent-skill.js';
import { substituteArgs } from './skill-args.js';

const SKILL_FILENAME = 'SKILL.md';
const FRONTMATTER_MAX_LINES = 40;

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  whenToUse?: string;
  triggerPrefix?: string;
  aliases?: string[];
  argNames?: string[];
  allowedTools?: string[];
  model?: string;
  context?: 'inline';
  paths?: string[];
  effort?: number;
  exclusive?: boolean;
  priority?: number;
  modelInvocable?: boolean;
}

/**
 * Parse YAML-like frontmatter from markdown content.
 * Only handles simple key: value and key: [array] — no nested objects.
 */
export function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1]!;
  const result: Record<string, unknown> = {};

  for (const line of yaml.split('\n').slice(0, FRONTMATTER_MAX_LINES)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (!kv) continue;

    const key = kv[1]!;
    let value: unknown = kv[2]!.trim();

    // Parse inline arrays: [a, b, c]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    }
    // Parse booleans
    else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    // Parse numbers
    else if (typeof value === 'string' && /^\d+$/.test(value)) value = parseInt(value, 10);
    // Unquote strings
    else if (typeof value === 'string') value = value.replace(/^["']|["']$/g, '');

    result[key] = value;
  }

  // Normalize kebab-case keys to camelCase
  const fm: SkillFrontmatter = {};
  fm.name = str(result['name']);
  fm.description = str(result['description']);
  fm.whenToUse = str(result['whenToUse'] ?? result['when-to-use'] ?? result['when_to_use']);
  fm.triggerPrefix = str(result['triggerPrefix'] ?? result['trigger-prefix']);
  fm.aliases = arr(result['aliases']);
  fm.argNames = arr(result['argNames'] ?? result['arg-names'] ?? result['arguments']);
  fm.allowedTools = arr(result['allowedTools'] ?? result['allowed-tools']);
  fm.model = str(result['model']);
  fm.paths = arr(result['paths']);
  fm.effort = typeof result['effort'] === 'number' ? result['effort'] : undefined;
  fm.exclusive = typeof result['exclusive'] === 'boolean' ? result['exclusive'] : undefined;
  fm.priority = typeof result['priority'] === 'number' ? result['priority'] : undefined;
  fm.modelInvocable = typeof result['modelInvocable'] === 'boolean'
    ? result['modelInvocable']
    : typeof result['model-invocable'] === 'boolean'
      ? (result['model-invocable'] as boolean)
      : undefined;

  const ctx = str(result['context']);
  if (ctx === 'inline') fm.context = ctx;

  return fm;
}

/**
 * Extract body content (after frontmatter).
 */
export function extractBody(content: string): string {
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)/);
  return match?.[1]?.trim() ?? content.trim();
}

// ---------------------------------------------------------------------------
// Skill file loading
// ---------------------------------------------------------------------------

/**
 * Load a single SKILL.md file into an AgentSkill.
 */
export async function loadSkillFile(filePath: string): Promise<AgentSkill | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const fm = parseSkillFrontmatter(content);
    const body = extractBody(content);

    if (!body && !fm.description) return null;

    const skillDir = dirname(filePath);
    const fallbackName = basename(skillDir);
    const name = fm.name || fallbackName;

    const skill: AgentSkill = {
      name,
      description: fm.description || name,
      instructions: body,
      source: 'directory',
      skillDir,
    };

    // Apply optional frontmatter fields
    if (fm.whenToUse) skill.whenToUse = fm.whenToUse;
    if (fm.triggerPrefix) skill.triggerPrefix = fm.triggerPrefix;
    if (fm.aliases) skill.aliases = fm.aliases;
    if (fm.argNames) skill.argNames = fm.argNames;
    if (fm.allowedTools) skill.allowedTools = fm.allowedTools;
    if (fm.model) skill.model = fm.model;
    if (fm.context) skill.context = fm.context;
    if (fm.paths) skill.paths = fm.paths;
    if (fm.effort !== undefined) skill.effort = fm.effort;
    if (fm.exclusive !== undefined) skill.exclusive = fm.exclusive;
    if (fm.priority !== undefined) skill.priority = fm.priority;
    if (fm.modelInvocable !== undefined) skill.modelInvocable = fm.modelInvocable;

    // If skill has argNames, wrap instructions in a getPrompt that does substitution
    if (fm.argNames && fm.argNames.length > 0) {
      const argNames = fm.argNames;
      skill.getPrompt = (args: string, ctx) => {
        return substituteArgs(body, args, argNames, {
          SKILL_DIR: ctx.skillDir ?? skillDir,
          THREAD_ID: ctx.threadId,
          TRACE_ID: ctx.traceId,
        });
      };
    }

    return skill;
  } catch {
    return null;
  }
}

/**
 * Scan a directory for skill files and return AgentSkill objects.
 *
 * Supports two layouts:
 *   dir/skill-name/SKILL.md   (subdirectory per skill)
 *   dir/skill-name.md         (flat file per skill)
 */
export async function scanSkillFiles(dir: string): Promise<AgentSkill[]> {
  const skills: AgentSkill[] = [];

  try {
    const entries = await readdir(dir);

    for (const entry of entries) {
      const entryPath = join(dir, entry);

      try {
        const entryStat = await stat(entryPath);

        if (entryStat.isDirectory()) {
          // Subdirectory layout: skill-name/SKILL.md
          const skillFile = join(entryPath, SKILL_FILENAME);
          const skill = await loadSkillFile(skillFile);
          if (skill) skills.push(skill);
        } else if (entry.endsWith('.md') && entry !== 'README.md') {
          // Flat layout: skill-name.md
          const skill = await loadSkillFile(entryPath);
          if (skill) skills.push(skill);
        }
      } catch {
        // Skip entries that can't be read
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return skills;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function arr(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.filter(x => typeof x === 'string');
  if (typeof v === 'string') return v.split(/\s+/).filter(Boolean);
  return undefined;
}

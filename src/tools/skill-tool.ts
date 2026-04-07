/**
 * SkillTool — allows the LLM to invoke skills as tool calls mid-loop.
 *
 * Ported from old_src/tools/SkillTool/SkillTool.ts with adaptations for SDK context.
 *
 * Key behaviors from old_src:
 * - Skill lookup by exact name, alias, and triggerPrefix
 * - Validates modelInvocable flag (disableModelInvocation equivalent)
 * - Dynamic prompt resolution via resolveInstructions()
 * - Registers skill-scoped tools in ToolExecutor when skill activates
 * - Returns resolved prompt as tagged block for the model
 * - Tracks invocation for session (survives compaction via invoked set)
 *
 * Differences from old_src:
 * - No permission system (SDK has no interactive UI to ask user)
 * - No fork mode (SDK uses inline execution only)
 * - No contextModifier (SDK doesn't support mid-loop model/effort override)
 * - No remote skill loading (CLI-specific feature)
 */

import { z } from 'zod';
import type { AgentTool } from '../contracts/entities/agent-tool.js';
import type { AgentSkill } from '../contracts/entities/agent-skill.js';
import type { ToolExecutor } from './tool-executor.js';
import type { SkillManager } from '../skills/skill-manager.js';

export const SKILL_TOOL_NAME = 'Skill';

const SkillToolParameters = z.object({
  skill: z.string().describe('The skill name. E.g., "commit", "review-pr", or "translate"'),
  args: z.string().optional().describe('Optional arguments for the skill'),
});

export interface SkillToolContext {
  threadId: string;
  traceId: string;
}

/**
 * Build the system prompt section that teaches the model how to use the Skill tool.
 * Ported from old_src/tools/SkillTool/prompt.ts getPrompt().
 */
export function buildSkillToolPrompt(listing: string): string {
  return [
    'You have access to a Skill tool that activates specialized behaviors.',
    '',
    'How to invoke:',
    '- Use the Skill tool with the skill name and optional arguments',
    '- Examples:',
    '  - `skill: "review"` — invoke the review skill',
    '  - `skill: "translate", args: "pt Hello world"` — invoke with arguments',
    '  - `skill: "commit", args: "-m \'Fix bug\'"` — invoke with arguments',
    '',
    'Important:',
    '- When a skill matches the user\'s request, invoke it BEFORE generating other responses',
    '- Do not mention a skill without actually calling the Skill tool',
    '- Do not invoke a skill that is already active in the current context',
    '- If a <skill> tag already appears in the conversation, the skill is ALREADY loaded — follow its instructions directly instead of calling the Skill tool again',
    '',
    listing,
  ].join('\n');
}

/**
 * Find a skill by name, alias, or triggerPrefix.
 * Normalized: strips leading "/" for compatibility.
 */
function findSkill(skillManager: SkillManager, skillName: string): AgentSkill | undefined {
  const allSkills = skillManager.listAllSkills();

  // 1. Exact name match
  const byName = allSkills.find(s => s.name === skillName);
  if (byName) return byName;

  // 2. Normalized name (strip leading /)
  const normalized = skillName.startsWith('/') ? skillName.slice(1) : skillName;
  const byNormalized = allSkills.find(s =>
    s.name === normalized
    || s.aliases?.some(a => {
      const clean = a.startsWith('/') ? a.slice(1) : a;
      return clean === normalized;
    }),
  );
  if (byNormalized) return byNormalized;

  // 3. triggerPrefix match
  const withSlash = skillName.startsWith('/') ? skillName : `/${skillName}`;
  return allSkills.find(s => s.triggerPrefix === withSlash);
}

/**
 * Create the Skill tool that the model can invoke during the react loop.
 *
 * @param skillManager — manages skill registry and resolution
 * @param toolExecutor — used to register skill-scoped tools mid-loop
 * @param getContext — returns current execution context (threadId, traceId)
 */
export function createSkillTool(
  skillManager: SkillManager,
  toolExecutor: ToolExecutor,
  getContext: () => SkillToolContext,
): AgentTool {
  // Track tools registered by skills during this session (for cleanup)
  const registeredSkillTools = new Set<string>();

  return {
    name: SKILL_TOOL_NAME,
    description: 'Execute a skill by name. Use this when you want to activate a skill\'s specialized behavior. Pass the skill name and optional arguments.',
    parameters: SkillToolParameters,
    isConcurrencySafe: false,

    execute: async (rawArgs: unknown) => {
      const { skill: skillName, args = '' } = rawArgs as z.infer<typeof SkillToolParameters>;
      const ctx = getContext();

      // --- Find skill ---
      const skill = findSkill(skillManager, skillName);

      if (!skill) {
        const available = skillManager.listSkills().map(s => s.name).join(', ');
        return {
          content: `Skill "${skillName}" not found. Available skills: ${available || 'none'}`,
          isError: true,
        };
      }

      // --- Validate ---
      if (skill.isEnabled && !skill.isEnabled()) {
        return {
          content: `Skill "${skill.name}" is currently disabled.`,
          isError: true,
        };
      }

      if (skill.modelInvocable === false) {
        return {
          content: `Skill "${skill.name}" cannot be invoked by the model. It must be invoked directly by the user.`,
          isError: true,
        };
      }

      // --- Resolve instructions ---
      const resolved = await skillManager.resolveInstructions(skill, args, {
        threadId: ctx.threadId,
        traceId: ctx.traceId,
        skillDir: skill.skillDir,
      });

      // --- Register skill-scoped tools ---
      if (skill.tools?.length) {
        for (const tool of skill.tools) {
          if (!registeredSkillTools.has(tool.name)) {
            toolExecutor.register(tool);
            registeredSkillTools.add(tool.name);
          }
        }
      }

      // --- Track invocation ---
      skillManager.markInvoked(skill.name);

      // --- Build result ---
      const parts: string[] = [
        `<skill name="${skill.name}">`,
        resolved,
        '</skill>',
      ];

      // Append metadata hints for the model
      if (skill.tools?.length) {
        const toolNames = skill.tools.map(t => t.name).join(', ');
        parts.push('', `This skill provides tools: ${toolNames}. Use them as needed.`);
      }

      if (skill.model) {
        parts.push('', `[Note: This skill recommends model "${skill.model}" but the current model will be used.]`);
      }

      parts.push('', `Follow the instructions above from the "${skill.name}" skill.`);

      return parts.join('\n');
    },
  };
}

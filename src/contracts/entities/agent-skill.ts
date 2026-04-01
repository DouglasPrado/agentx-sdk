import type { AgentTool } from './agent-tool.js';

/** A skill that modifies Agent behavior when activated */
export interface AgentSkill {
  name: string;
  description: string;
  instructions: string;
  tools?: AgentTool[];
  match?: (input: string, context: SkillMatchContext) => boolean;
  triggerPrefix?: string;
  priority?: number;
  exclusive?: boolean;
}

/** Context passed to skill.match() */
export interface SkillMatchContext {
  threadId: string;
  recentMessages: number;
}

import type { ZodSchema } from 'zod';
import type { AgentToolResult } from './tool-call.js';

/** A tool that the Agent can invoke during the ReactLoop */
export interface AgentTool {
  name: string;
  description: string;
  parameters: ZodSchema;
  execute: (args: unknown, signal: AbortSignal) => Promise<string | AgentToolResult>;
  validate?: (args: unknown, context: ToolValidationContext) => Promise<string | null>;
}

/** Context passed to tool.validate() for semantic validation */
export interface ToolValidationContext {
  threadId: string;
  recentMessages: number;
}

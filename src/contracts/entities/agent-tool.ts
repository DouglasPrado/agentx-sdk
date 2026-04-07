import type { ZodSchema } from 'zod';
import type { AgentToolResult } from './tool-call.js';

/** Progress callback — tools call this to report incremental updates */
export type ToolProgressCallback = (data: Record<string, unknown>) => void;

/** A tool that the Agent can invoke during the ReactLoop */
export interface AgentTool {
  name: string;
  description: string;
  parameters: ZodSchema;
  execute: (
    args: unknown,
    signal: AbortSignal,
    onProgress?: ToolProgressCallback,
  ) => Promise<string | AgentToolResult>;

  /** Semantic validation — return error string to reject, null to allow. Called before execute. */
  validate?: (args: unknown, context: ToolValidationContext) => Promise<string | null>;

  /**
   * Whether this tool is safe to run concurrently with other concurrency-safe tools.
   * Read-only tools (search, read) should be `true`; write tools (edit, bash) should be `false`.
   * Can be a function to decide per-invocation based on args.
   * Default: false (serial execution).
   */
  isConcurrencySafe?: boolean | ((args: unknown) => boolean);

  /** Whether this tool only reads data (no side effects). */
  isReadOnly?: boolean | ((args: unknown) => boolean);

  /** Whether this tool performs irreversible operations (delete, send, overwrite). */
  isDestructive?: boolean | ((args: unknown) => boolean);

  /** Extract file path(s) from args — enables conditional skill activation when files are touched. */
  getFilePath?: (args: unknown) => string | string[] | undefined;

  /** Per-tool timeout in milliseconds. Wraps execute with AbortSignal. */
  timeoutMs?: number;

  /** Max characters for tool result before truncation. Default: 10_000. */
  maxResultChars?: number;

  /** Transform result before sending to model. */
  mapResult?: (result: AgentToolResult) => AgentToolResult;

  /** Whether transient failures should be retried. Default: false. */
  retryable?: boolean | ((error: unknown) => boolean);

  /** Max retry attempts for transient failures. Default: 2. */
  maxRetries?: number;
}

/** Context passed to tool.validate() for semantic validation */
export interface ToolValidationContext {
  threadId: string;
  recentMessages: number;
}

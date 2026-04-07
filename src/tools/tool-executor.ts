import { ZodError, type ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { AgentTool, ToolProgressCallback } from '../contracts/entities/agent-tool.js';
import type { AgentToolResult } from '../contracts/entities/tool-call.js';
import type { ToolDefinition } from '../llm/message-types.js';
import { retry } from '../utils/retry.js';

export interface ToolCallRequest {
  name: string;
  args: unknown;
}

export interface ToolHooks {
  beforeToolCall?: (name: string, args: unknown) => void | Promise<void>;
  afterToolCall?: (name: string, args: unknown, result: AgentToolResult) => void | Promise<void>;
  onToolProgress?: (name: string, toolCallId: string, data: Record<string, unknown>) => void;
}

export interface ExecuteOptions {
  signal?: AbortSignal;
  toolCallId?: string;
  threadId?: string;
  onProgress?: ToolProgressCallback;
}

const DEFAULT_MAX_RESULT_CHARS = 10_000;
const TRUNCATE_HEAD_RATIO = 0.7;
const TRUNCATE_TAIL_RATIO = 0.2;

/**
 * Registers tools, validates args via Zod, converts to JSON Schema,
 * and executes tools with full pipeline:
 *
 *   1. Tool lookup
 *   2. Zod schema validation
 *   3. Semantic validation (tool.validate)
 *   4. Before hook
 *   5. Per-tool timeout wrapping
 *   6. Retry for transient failures
 *   7. Execute with progress callback
 *   8. Result truncation (tool.maxResultChars)
 *   9. Result mapping (tool.mapResult)
 *  10. After hook
 */
export class ToolExecutor {
  private readonly tools = new Map<string, AgentTool>();
  private readonly hooks: ToolHooks;

  constructor(hooks: ToolHooks = {}) {
    this.hooks = hooks;
  }

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  listTools(): AgentTool[] {
    return [...this.tools.values()];
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.listTools().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters as ZodSchema, { target: 'openApi3' }) as Record<string, unknown>,
      },
    }));
  }

  async execute(name: string, args: unknown, signalOrOptions?: AbortSignal | ExecuteOptions): Promise<AgentToolResult> {
    // Normalize options (backward compatible — accepts bare AbortSignal)
    const opts: ExecuteOptions = signalOrOptions instanceof AbortSignal
      ? { signal: signalOrOptions }
      : signalOrOptions ?? {};

    const tool = this.tools.get(name);
    if (!tool) {
      return { content: `Tool "${name}" not found`, isError: true };
    }

    // 1. Zod schema validation
    let validatedArgs: unknown;
    try {
      validatedArgs = (tool.parameters as ZodSchema).parse(args);
    } catch (error) {
      if (error instanceof ZodError) {
        return { content: `Validation error: ${error.errors.map(e => e.message).join(', ')}`, isError: true };
      }
      return { content: `Validation error: ${String(error)}`, isError: true };
    }

    // 2. Semantic validation (tool.validate)
    if (tool.validate) {
      try {
        const validationError = await tool.validate(validatedArgs, {
          threadId: opts.threadId ?? 'default',
          recentMessages: 0,
        });
        if (validationError) {
          return { content: `Validation error: ${validationError}`, isError: true };
        }
      } catch (error) {
        return { content: `Validation error: ${error instanceof Error ? error.message : String(error)}`, isError: true };
      }
    }

    // 3. Before hook
    if (this.hooks.beforeToolCall) {
      await this.hooks.beforeToolCall(name, validatedArgs);
    }

    // 4. Build execution signal (per-tool timeout + parent signal)
    const execSignal = this.buildSignal(tool, opts.signal);

    // 5. Build progress callback
    const onProgress: ToolProgressCallback | undefined = opts.onProgress
      ?? (opts.toolCallId && this.hooks.onToolProgress
        ? (data) => this.hooks.onToolProgress!(name, opts.toolCallId!, data)
        : undefined);

    // 6. Execute (with retry if retryable)
    let result: AgentToolResult;
    try {
      result = await this.executeWithRetry(tool, validatedArgs, execSignal, onProgress);
    } catch (error) {
      result = { content: `Tool error: ${error instanceof Error ? error.message : String(error)}`, isError: true };
    }

    // 7. Result truncation
    const maxChars = tool.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS;
    if (!result.isError && result.content.length > maxChars) {
      result = {
        ...result,
        content: truncateResult(result.content, maxChars),
        metadata: { ...result.metadata, truncated: true, originalLength: result.content.length },
      };
    }

    // 8. Result mapping
    if (tool.mapResult) {
      result = tool.mapResult(result);
    }

    // 9. After hook
    if (this.hooks.afterToolCall) {
      await this.hooks.afterToolCall(name, validatedArgs, result);
    }

    return result;
  }

  async executeParallel(calls: ToolCallRequest[], signal?: AbortSignal): Promise<AgentToolResult[]> {
    return Promise.all(calls.map(call => this.execute(call.name, call.args, signal)));
  }

  /**
   * Executes tool calls respecting concurrency safety:
   * - Consecutive concurrency-safe tools run in parallel
   * - Non-safe tools run serially (one at a time)
   * - Results are returned in the original call order
   */
  async executePartitioned(
    calls: Array<{ id: string; name: string; args: unknown }>,
    signal?: AbortSignal,
  ): Promise<Array<{ id: string; result: AgentToolResult }>> {
    const results: Array<{ id: string; result: AgentToolResult }> = [];

    // Partition into batches of consecutive safe/unsafe tools
    const batches: Array<{ calls: typeof calls; concurrent: boolean }> = [];
    let currentBatch: typeof calls = [];
    let currentConcurrent = false;

    for (const call of calls) {
      const tool = this.tools.get(call.name);
      const isSafe = tool
        ? typeof tool.isConcurrencySafe === 'function'
          ? tool.isConcurrencySafe(call.args)
          : tool.isConcurrencySafe === true
        : false;

      if (currentBatch.length === 0) {
        currentConcurrent = isSafe;
        currentBatch.push(call);
      } else if (isSafe === currentConcurrent && isSafe) {
        currentBatch.push(call);
      } else {
        batches.push({ calls: currentBatch, concurrent: currentConcurrent });
        currentBatch = [call];
        currentConcurrent = isSafe;
      }
    }
    if (currentBatch.length > 0) {
      batches.push({ calls: currentBatch, concurrent: currentConcurrent });
    }

    for (const batch of batches) {
      if (batch.concurrent) {
        const batchResults = await Promise.all(
          batch.calls.map(async (call) => ({
            id: call.id,
            result: await this.execute(call.name, call.args, signal),
          })),
        );
        results.push(...batchResults);
      } else {
        for (const call of batch.calls) {
          const result = await this.execute(call.name, call.args, signal);
          results.push({ id: call.id, result });
        }
      }
    }

    return results;
  }

  // --- Private helpers ---

  /**
   * Build an AbortSignal combining parent signal + per-tool timeout.
   */
  private buildSignal(tool: AgentTool, parentSignal?: AbortSignal): AbortSignal {
    if (!tool.timeoutMs && !parentSignal) {
      return new AbortController().signal;
    }

    if (!tool.timeoutMs) return parentSignal!;

    const timeoutSignal = AbortSignal.timeout(tool.timeoutMs);
    if (!parentSignal) return timeoutSignal;

    // Combine both signals
    return AbortSignal.any([parentSignal, timeoutSignal]);
  }

  /**
   * Execute with retry support using the existing retry utility.
   */
  private async executeWithRetry(
    tool: AgentTool,
    args: unknown,
    signal: AbortSignal,
    onProgress?: ToolProgressCallback,
  ): Promise<AgentToolResult> {
    const execFn = async () => {
      const raw = await tool.execute(args, signal, onProgress);
      return typeof raw === 'string' ? { content: raw } : raw;
    };

    if (!tool.retryable) {
      return execFn();
    }

    const isRetryable = typeof tool.retryable === 'function'
      ? tool.retryable
      : (error: unknown) => {
          // Don't retry abort errors
          if (error instanceof DOMException && error.name === 'AbortError') return false;
          return true;
        };

    return retry(execFn, {
      maxRetries: tool.maxRetries ?? 2,
      initialDelay: 500,
      backoffMultiplier: 2,
      maxDelay: 5_000,
      signal,
      isRetryable,
    });
  }
}

/**
 * Truncate tool result content preserving head and tail.
 * Same strategy as microcompact (70% head, 20% tail).
 */
function truncateResult(content: string, maxChars: number): string {
  const headSize = Math.floor(maxChars * TRUNCATE_HEAD_RATIO);
  const tailSize = Math.floor(maxChars * TRUNCATE_TAIL_RATIO);
  const head = content.slice(0, headSize);
  const tail = content.slice(-tailSize);
  const omitted = content.length - headSize - tailSize;
  return `${head}\n\n[truncated ${omitted} characters]\n\n${tail}`;
}

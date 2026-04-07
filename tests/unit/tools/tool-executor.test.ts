import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ToolExecutor } from '../../../src/tools/tool-executor.js';
import type { AgentTool } from '../../../src/contracts/entities/agent-tool.js';

function createTool(overrides: Partial<AgentTool> = {}): AgentTool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    parameters: z.object({ input: z.string() }),
    execute: vi.fn().mockResolvedValue('result'),
    ...overrides,
  };
}

describe('ToolExecutor', () => {
  it('should register and list tools', () => {
    const executor = new ToolExecutor();
    executor.register(createTool({ name: 'tool_a' }));
    executor.register(createTool({ name: 'tool_b' }));

    const tools = executor.listTools();
    expect(tools).toHaveLength(2);
    expect(tools.map(t => t.name)).toContain('tool_a');
  });

  it('should overwrite tool with same name', () => {
    const executor = new ToolExecutor();
    executor.register(createTool({ name: 'tool_a', description: 'v1' }));
    executor.register(createTool({ name: 'tool_a', description: 'v2' }));

    expect(executor.listTools()).toHaveLength(1);
    expect(executor.listTools()[0]!.description).toBe('v2');
  });

  it('should execute a tool with valid args', async () => {
    const executeFn = vi.fn().mockResolvedValue('hello');
    const executor = new ToolExecutor();
    executor.register(createTool({ execute: executeFn }));

    const result = await executor.execute('test_tool', { input: 'test' });
    expect(result.content).toBe('hello');
    expect(result.isError).toBeFalsy();
    expect(executeFn).toHaveBeenCalledWith({ input: 'test' }, expect.any(AbortSignal), undefined);
  });

  it('should reject invalid args via Zod', async () => {
    const executor = new ToolExecutor();
    executor.register(createTool());

    const result = await executor.execute('test_tool', { input: 123 });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Validation');
  });

  it('should return error for unknown tool', async () => {
    const executor = new ToolExecutor();
    const result = await executor.execute('nonexistent', {});
    expect(result.isError).toBe(true);
    expect(result.content).toContain('not found');
  });

  it('should handle tool execution errors', async () => {
    const executor = new ToolExecutor();
    executor.register(createTool({
      execute: vi.fn().mockRejectedValue(new Error('boom')),
    }));

    const result = await executor.execute('test_tool', { input: 'test' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('boom');
  });

  it('should convert Zod schemas to JSON Schema for tool definitions', () => {
    const executor = new ToolExecutor();
    executor.register(createTool({
      name: 'weather',
      description: 'Get weather',
      parameters: z.object({ city: z.string(), unit: z.enum(['C', 'F']).optional() }),
    }));

    const defs = executor.getToolDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0]!.type).toBe('function');
    expect(defs[0]!.function.name).toBe('weather');
    expect(defs[0]!.function.parameters).toHaveProperty('properties');
  });

  it('should execute tools in parallel', async () => {
    const executor = new ToolExecutor();
    const slow = vi.fn().mockImplementation(() => new Promise(r => setTimeout(() => r('a'), 50)));
    const fast = vi.fn().mockResolvedValue('b');

    executor.register(createTool({ name: 'slow', execute: slow }));
    executor.register(createTool({ name: 'fast', execute: fast }));

    const start = Date.now();
    const results = await executor.executeParallel([
      { name: 'slow', args: { input: 'x' } },
      { name: 'fast', args: { input: 'y' } },
    ]);
    const elapsed = Date.now() - start;

    expect(results).toHaveLength(2);
    expect(elapsed).toBeLessThan(150); // parallel, not sequential (~100ms)
  });

  it('should support AbortSignal', async () => {
    const controller = new AbortController();
    controller.abort(); // Pre-abort
    const executor = new ToolExecutor();
    executor.register(createTool({
      execute: vi.fn().mockImplementation(() => {
        throw new Error('Aborted');
      }),
    }));

    const result = await executor.execute('test_tool', { input: 'test' }, controller.signal);
    expect(result.isError).toBe(true);
  });

  it('should run beforeToolCall and afterToolCall hooks', async () => {
    const before = vi.fn();
    const after = vi.fn();
    const executor = new ToolExecutor({ beforeToolCall: before, afterToolCall: after });
    executor.register(createTool());

    await executor.execute('test_tool', { input: 'hi' });

    expect(before).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledOnce();
  });

  // --- New pipeline features ---

  it('should call validate() and short-circuit on error', async () => {
    const executor = new ToolExecutor();
    const executeFn = vi.fn().mockResolvedValue('should not reach');
    executor.register(createTool({
      execute: executeFn,
      validate: async (args) => {
        const { input } = args as { input: string };
        if (input === 'bad') return 'Input is invalid';
        return null;
      },
    }));

    const result = await executor.execute('test_tool', { input: 'bad' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Input is invalid');
    expect(executeFn).not.toHaveBeenCalled();
  });

  it('should allow execution when validate() returns null', async () => {
    const executor = new ToolExecutor();
    executor.register(createTool({
      validate: async () => null,
    }));

    const result = await executor.execute('test_tool', { input: 'good' });
    expect(result.isError).toBeFalsy();
  });

  it('should truncate large results based on maxResultChars', async () => {
    const executor = new ToolExecutor();
    const bigContent = 'x'.repeat(5000);
    executor.register(createTool({
      execute: vi.fn().mockResolvedValue(bigContent),
      maxResultChars: 100,
    }));

    const result = await executor.execute('test_tool', { input: 'test' });
    expect(result.content.length).toBeLessThan(200);
    expect(result.content).toContain('[truncated');
    expect(result.metadata?.truncated).toBe(true);
  });

  it('should not truncate results within limit', async () => {
    const executor = new ToolExecutor();
    executor.register(createTool({
      execute: vi.fn().mockResolvedValue('short'),
      maxResultChars: 100,
    }));

    const result = await executor.execute('test_tool', { input: 'test' });
    expect(result.content).toBe('short');
    expect(result.metadata?.truncated).toBeUndefined();
  });

  it('should apply mapResult transformation', async () => {
    const executor = new ToolExecutor();
    executor.register(createTool({
      execute: vi.fn().mockResolvedValue('raw output'),
      mapResult: (r) => ({ ...r, content: `[mapped] ${r.content}` }),
    }));

    const result = await executor.execute('test_tool', { input: 'test' });
    expect(result.content).toBe('[mapped] raw output');
  });

  it('should timeout with timeoutMs', async () => {
    const executor = new ToolExecutor();
    executor.register(createTool({
      execute: vi.fn().mockImplementation(async (_args, signal) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 5000);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
        return 'should not reach';
      }),
      timeoutMs: 50,
    }));

    const result = await executor.execute('test_tool', { input: 'test' });
    expect(result.isError).toBe(true);
  });

  it('should retry transient failures when retryable is true', async () => {
    const executor = new ToolExecutor();
    let callCount = 0;
    executor.register(createTool({
      execute: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) throw new Error('Transient failure');
        return 'success after retries';
      }),
      retryable: true,
      maxRetries: 2,
    }));

    const result = await executor.execute('test_tool', { input: 'test' });
    expect(result.content).toBe('success after retries');
    expect(callCount).toBe(3);
  });

  it('should pass onProgress callback to execute', async () => {
    const executor = new ToolExecutor();
    const progressData: Record<string, unknown>[] = [];

    executor.register(createTool({
      execute: vi.fn().mockImplementation(async (_args, _signal, onProgress) => {
        onProgress?.({ step: 1, status: 'loading' });
        onProgress?.({ step: 2, status: 'done' });
        return 'ok';
      }),
    }));

    await executor.execute('test_tool', { input: 'test' }, {
      onProgress: (data) => progressData.push(data),
    });

    expect(progressData).toHaveLength(2);
    expect(progressData[0]).toEqual({ step: 1, status: 'loading' });
  });

  it('should accept ExecuteOptions object', async () => {
    const executor = new ToolExecutor();
    executor.register(createTool());

    const result = await executor.execute('test_tool', { input: 'test' }, {
      signal: new AbortController().signal,
      threadId: 'thread-1',
      toolCallId: 'tc-1',
    });

    expect(result.isError).toBeFalsy();
  });
});

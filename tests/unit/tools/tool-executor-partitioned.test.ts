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

describe('ToolExecutor.executePartitioned', () => {
  it('should run consecutive concurrency-safe tools in parallel', async () => {
    const executor = new ToolExecutor();
    const order: string[] = [];

    executor.register(createTool({
      name: 'read_a',
      isConcurrencySafe: true,
      execute: vi.fn().mockImplementation(async () => {
        order.push('read_a:start');
        await new Promise(r => setTimeout(r, 50));
        order.push('read_a:end');
        return 'a';
      }),
    }));

    executor.register(createTool({
      name: 'read_b',
      isConcurrencySafe: true,
      execute: vi.fn().mockImplementation(async () => {
        order.push('read_b:start');
        await new Promise(r => setTimeout(r, 50));
        order.push('read_b:end');
        return 'b';
      }),
    }));

    const start = Date.now();
    const results = await executor.executePartitioned([
      { id: 'c1', name: 'read_a', args: { input: 'x' } },
      { id: 'c2', name: 'read_b', args: { input: 'y' } },
    ]);
    const elapsed = Date.now() - start;

    // Both should have started before either finished (parallel)
    expect(order[0]).toBe('read_a:start');
    expect(order[1]).toBe('read_b:start');

    // Should complete in ~50ms, not ~100ms
    expect(elapsed).toBeLessThan(120);

    // Results in original order
    expect(results).toHaveLength(2);
    expect(results[0]!.id).toBe('c1');
    expect(results[0]!.result.content).toBe('a');
    expect(results[1]!.id).toBe('c2');
    expect(results[1]!.result.content).toBe('b');
  });

  it('should run non-safe tools serially', async () => {
    const executor = new ToolExecutor();
    const order: string[] = [];

    executor.register(createTool({
      name: 'write_a',
      isConcurrencySafe: false,
      execute: vi.fn().mockImplementation(async () => {
        order.push('write_a:start');
        await new Promise(r => setTimeout(r, 30));
        order.push('write_a:end');
        return 'a';
      }),
    }));

    executor.register(createTool({
      name: 'write_b',
      isConcurrencySafe: false,
      execute: vi.fn().mockImplementation(async () => {
        order.push('write_b:start');
        await new Promise(r => setTimeout(r, 30));
        order.push('write_b:end');
        return 'b';
      }),
    }));

    const results = await executor.executePartitioned([
      { id: 'c1', name: 'write_a', args: { input: 'x' } },
      { id: 'c2', name: 'write_b', args: { input: 'y' } },
    ]);

    // Serial: write_a must finish before write_b starts
    expect(order).toEqual(['write_a:start', 'write_a:end', 'write_b:start', 'write_b:end']);

    expect(results).toHaveLength(2);
    expect(results[0]!.id).toBe('c1');
    expect(results[1]!.id).toBe('c2');
  });

  it('should handle mixed safe/unsafe tools preserving batch order', async () => {
    const executor = new ToolExecutor();
    const order: string[] = [];

    executor.register(createTool({
      name: 'read_x',
      isConcurrencySafe: true,
      execute: vi.fn().mockImplementation(async () => { order.push('read_x'); return 'rx'; }),
    }));
    executor.register(createTool({
      name: 'read_y',
      isConcurrencySafe: true,
      execute: vi.fn().mockImplementation(async () => { order.push('read_y'); return 'ry'; }),
    }));
    executor.register(createTool({
      name: 'write_z',
      isConcurrencySafe: false,
      execute: vi.fn().mockImplementation(async () => { order.push('write_z'); return 'wz'; }),
    }));

    const results = await executor.executePartitioned([
      { id: 'c1', name: 'read_x', args: { input: 'a' } },
      { id: 'c2', name: 'read_y', args: { input: 'b' } },
      { id: 'c3', name: 'write_z', args: { input: 'c' } },
    ]);

    // read_x and read_y should complete before write_z
    expect(order.indexOf('write_z')).toBeGreaterThan(order.indexOf('read_x'));
    expect(order.indexOf('write_z')).toBeGreaterThan(order.indexOf('read_y'));

    expect(results).toHaveLength(3);
    expect(results[0]!.id).toBe('c1');
    expect(results[1]!.id).toBe('c2');
    expect(results[2]!.id).toBe('c3');
  });

  it('should support isConcurrencySafe as a function', async () => {
    const executor = new ToolExecutor();

    executor.register(createTool({
      name: 'bash',
      isConcurrencySafe: (args: unknown) => {
        const a = args as { input: string };
        return a.input.startsWith('ls');
      },
      execute: vi.fn().mockResolvedValue('ok'),
    }));

    // Two "ls" commands should be concurrent-safe
    const results = await executor.executePartitioned([
      { id: 'c1', name: 'bash', args: { input: 'ls /tmp' } },
      { id: 'c2', name: 'bash', args: { input: 'ls /home' } },
    ]);

    expect(results).toHaveLength(2);
  });

  it('should default to serial for tools without isConcurrencySafe', async () => {
    const executor = new ToolExecutor();
    const order: string[] = [];

    executor.register(createTool({
      name: 'tool_a',
      // No isConcurrencySafe — defaults to false
      execute: vi.fn().mockImplementation(async () => {
        order.push('a:start');
        await new Promise(r => setTimeout(r, 20));
        order.push('a:end');
        return 'a';
      }),
    }));

    executor.register(createTool({
      name: 'tool_b',
      execute: vi.fn().mockImplementation(async () => {
        order.push('b:start');
        await new Promise(r => setTimeout(r, 20));
        order.push('b:end');
        return 'b';
      }),
    }));

    await executor.executePartitioned([
      { id: 'c1', name: 'tool_a', args: { input: 'x' } },
      { id: 'c2', name: 'tool_b', args: { input: 'y' } },
    ]);

    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('should handle unknown tools gracefully', async () => {
    const executor = new ToolExecutor();
    const results = await executor.executePartitioned([
      { id: 'c1', name: 'nonexistent', args: {} },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]!.result.isError).toBe(true);
  });
});

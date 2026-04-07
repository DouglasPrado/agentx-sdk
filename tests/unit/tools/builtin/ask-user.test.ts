import { describe, it, expect, vi } from 'vitest';
import { createAskUserTool } from '../../../../src/tools/builtin/ask-user.js';

describe('builtin/ask-user', () => {
  const signal = new AbortController().signal;

  it('should return AgentTool with correct metadata', () => {
    const tool = createAskUserTool({ onAsk: async () => 'ok' });
    expect(tool.name).toBe('AskUser');
  });

  it('should call onAsk callback with question', async () => {
    const onAsk = vi.fn().mockResolvedValue('yes');
    const tool = createAskUserTool({ onAsk });

    const result = await tool.execute({ question: 'Continue?' }, signal);
    const content = typeof result === 'string' ? result : result.content;

    expect(onAsk).toHaveBeenCalledWith('Continue?', undefined);
    expect(content).toContain('yes');
  });

  it('should pass options to onAsk', async () => {
    const onAsk = vi.fn().mockResolvedValue('Option B');
    const tool = createAskUserTool({ onAsk });

    await tool.execute({ question: 'Pick one', options: ['Option A', 'Option B'] }, signal);

    expect(onAsk).toHaveBeenCalledWith('Pick one', ['Option A', 'Option B']);
  });

  it('should return error if onAsk throws', async () => {
    const tool = createAskUserTool({
      onAsk: async () => { throw new Error('User cancelled'); },
    });

    const result = await tool.execute({ question: 'Test' }, signal);
    const parsed = typeof result === 'string' ? { content: result, isError: false } : result;
    expect(parsed.isError).toBe(true);
  });
});

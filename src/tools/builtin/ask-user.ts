import { z } from 'zod';
import type { AgentTool } from '../../contracts/entities/agent-tool.js';

const AskUserParams = z.object({
  question: z.string().describe('Question to ask the user'),
  options: z.array(z.string()).optional().describe('Optional multiple-choice options'),
});

export interface AskUserOptions {
  /** Callback invoked when the model asks a question. Consumer implements this. */
  onAsk: (question: string, options?: string[]) => Promise<string>;
}

export function createAskUserTool(opts: AskUserOptions): AgentTool {
  return {
    name: 'AskUser',
    description: 'Ask the user a question and wait for their response. Use when you need clarification or confirmation.',
    parameters: AskUserParams,

    async execute(rawArgs: unknown) {
      const { question, options } = rawArgs as z.infer<typeof AskUserParams>;

      try {
        const answer = await opts.onAsk(question, options);
        return `User responded: ${answer}`;
      } catch (error) {
        return { content: `Failed to get user response: ${(error as Error).message}`, isError: true };
      }
    },
  };
}

import { exec } from 'node:child_process';
import { z } from 'zod';
import type { AgentTool } from '../../contracts/entities/agent-tool.js';

const DEFAULT_TIMEOUT = 120_000;
const MAX_OUTPUT = 500_000; // 500KB

const BashParams = z.object({
  command: z.string().describe('Shell command to execute'),
  timeout: z.number().optional().describe('Timeout in milliseconds. Default: 120000 (2 minutes).'),
});

export function createBashTool(): AgentTool {
  return {
    name: 'Bash',
    description: 'Execute a shell command and return stdout/stderr.',
    parameters: BashParams,
    isDestructive: true, // conservative — commands can have side effects
    timeoutMs: DEFAULT_TIMEOUT,

    async execute(rawArgs: unknown, signal: AbortSignal) {
      const { command, timeout } = rawArgs as z.infer<typeof BashParams>;
      const effectiveTimeout = timeout ?? DEFAULT_TIMEOUT;

      return new Promise<string | { content: string; isError?: boolean }>((resolve) => {
        exec(command, {
          timeout: effectiveTimeout,
          maxBuffer: MAX_OUTPUT,
          shell: process.env.SHELL || '/bin/sh',
          signal,
        }, (error, stdout, stderr) => {
          const out = stdout?.slice(0, MAX_OUTPUT) ?? '';
          const err = stderr?.slice(0, MAX_OUTPUT) ?? '';

          if (error) {
            const exitCode = error.code ?? 'unknown';
            const parts: string[] = [];
            if (out) parts.push(out);
            if (err) parts.push(err);
            if (!out && !err) parts.push(error.message);
            parts.push(`\nExit code: ${exitCode}`);

            resolve({ content: parts.join('\n'), isError: true });
            return;
          }

          const parts: string[] = [];
          if (out) parts.push(out);
          if (err) parts.push(`[stderr]\n${err}`);
          if (!out && !err) parts.push('(no output)');

          resolve(parts.join('\n'));
        });
      });
    },
  };
}

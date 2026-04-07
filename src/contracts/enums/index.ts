/** Message role in a conversation */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** File-based memory type (closed taxonomy) */
export type { MemoryType } from '../../memory/memory-types.js';

/** State of a ReactLoop execution */
export type ReactLoopState =
  | 'idle'
  | 'streaming'
  | 'executing_tools'
  | 'completed'
  | 'error'
  | 'cost_limited'
  | 'aborted';

/** Terminal states of ReactLoop — no further transitions allowed */
export const REACT_LOOP_TERMINAL_STATES: ReadonlySet<ReactLoopState> = new Set([
  'completed',
  'error',
  'cost_limited',
  'aborted',
]);

/** Agent session lifecycle state */
export type AgentSessionState =
  | 'initializing'
  | 'ready'
  | 'executing'
  | 'cost_exhausted'
  | 'destroying'
  | 'destroyed';

/** MCP connection lifecycle state */
export type MCPConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'reconnecting';

/** What to do when a tool call errors */
export type OnToolError = 'continue' | 'stop' | 'retry';

/** What to do when cost limit is reached */
export type OnLimitReached = 'stop' | 'warn';

/** Log level for the built-in logger */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/** Response format for structured output */
export type ResponseFormatType = 'text' | 'json_object' | 'json_schema';

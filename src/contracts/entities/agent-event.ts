import type { TokenUsage } from './token-usage.js';
import type { ToolCall, AgentToolResult } from './tool-call.js';

/** All possible agent events emitted during streaming */
export type AgentEvent =
  | AgentStartEvent
  | TextDeltaEvent
  | TextDoneEvent
  | ToolCallStartEvent
  | ToolCallDeltaEvent
  | ToolCallEndEvent
  | ToolProgressEvent
  | MemoryExtractedEvent
  | KnowledgeRetrievedEvent
  | SkillActivatedEvent
  | TurnStartEvent
  | TurnEndEvent
  | ErrorEvent
  | WarningEvent
  | CompactionEvent
  | RecoveryEvent
  | ModelFallbackEvent
  | AgentEndEvent;

export interface AgentStartEvent {
  type: 'agent_start';
  traceId: string;
  threadId: string;
  model: string;
}

export interface TextDeltaEvent {
  type: 'text_delta';
  content: string;
}

export interface TextDoneEvent {
  type: 'text_done';
  content: string;
}

export interface ToolCallStartEvent {
  type: 'tool_call_start';
  toolCall: ToolCall;
}

export interface ToolCallDeltaEvent {
  type: 'tool_call_delta';
  toolCallId: string;
  argumentsDelta: string;
}

export interface ToolCallEndEvent {
  type: 'tool_call_end';
  toolCallId: string;
  result: AgentToolResult;
  duration: number;
}

export interface ToolProgressEvent {
  type: 'tool_progress';
  toolCallId: string;
  toolName: string;
  data: Record<string, unknown>;
}

export interface MemoryExtractedEvent {
  type: 'memory_extracted';
  filename: string;
  content: string;
}

export interface KnowledgeRetrievedEvent {
  type: 'knowledge_retrieved';
  chunks: number;
  topScore: number;
}

export interface SkillActivatedEvent {
  type: 'skill_activated';
  skillName: string;
}

export interface TurnStartEvent {
  type: 'turn_start';
  iteration: number;
}

export interface TurnEndEvent {
  type: 'turn_end';
  iteration: number;
  hasToolCalls: boolean;
}

export interface ErrorEvent {
  type: 'error';
  error: Error;
  recoverable: boolean;
}

export interface WarningEvent {
  type: 'warning';
  message: string;
  code: string;
}

export interface CompactionEvent {
  type: 'compaction';
  strategy: 'microcompact' | 'autocompact';
  tokensFreed: number;
}

/** Recovery reason — matches ContinueReason values that represent recovery */
export type RecoveryReason =
  | 'max_output_tokens_escalate'
  | 'max_output_tokens_recovery'
  | 'reactive_compact_retry'
  | 'stop_hook_blocking'
  | 'token_budget_continuation'
  | 'tool_retry';

export interface RecoveryEvent {
  type: 'recovery';
  reason: RecoveryReason;
  attempt: number;
}

export interface ModelFallbackEvent {
  type: 'model_fallback';
  from: string;
  to: string;
}

export interface AgentEndEvent {
  type: 'agent_end';
  traceId: string;
  usage: TokenUsage;
  reason: 'stop' | 'cost_limit' | 'max_iterations' | 'error' | 'abort' | 'stop_hook' | 'prompt_too_long' | 'max_output_tokens';
  duration: number;
}

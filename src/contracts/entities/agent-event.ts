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
  | MemoryExtractedEvent
  | KnowledgeRetrievedEvent
  | SkillActivatedEvent
  | TurnStartEvent
  | TurnEndEvent
  | ErrorEvent
  | WarningEvent
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

export interface MemoryExtractedEvent {
  type: 'memory_extracted';
  memoryId: string;
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

export interface AgentEndEvent {
  type: 'agent_end';
  traceId: string;
  usage: TokenUsage;
  reason: 'stop' | 'cost_limit' | 'max_iterations' | 'error' | 'abort';
  duration: number;
}

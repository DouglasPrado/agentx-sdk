/** Tracing context for a single chat/stream execution */
export interface ExecutionContext {
  traceId: string;
  threadId: string;
  startedAt: number;
  model: string;
  parentTraceId?: string;
}

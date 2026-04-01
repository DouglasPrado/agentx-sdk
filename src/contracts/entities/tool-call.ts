/** A tool call requested by the LLM */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/** Result of a tool execution */
export interface AgentToolResult {
  content: string;
  metadata?: Record<string, unknown>;
  isError?: boolean;
}

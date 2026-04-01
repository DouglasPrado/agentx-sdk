import type { MessageRole } from '../enums/index.js';
import type { ContentPart } from './content-part.js';
import type { ToolCall } from './tool-call.js';

/** A single message in a conversation thread */
export interface ChatMessage {
  role: MessageRole;
  content: string | ContentPart[];
  toolCalls?: ToolCall[];
  toolCallId?: string;
  pinned?: boolean;
  createdAt: number;
}

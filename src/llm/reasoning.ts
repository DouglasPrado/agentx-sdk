import type { StreamChatParams } from './message-types.js';

// Matches reasoning families: o1, o3, o4, and gpt-5.x. Accepts optional
// "openai/" prefix so it works with both OpenRouter and direct OpenAI models.
const REASONING_MODEL_RE = /^(openai\/)?(o[134](-|$)|gpt-5(\.|-|$))/i;

export function isReasoningModel(model: string): boolean {
  return REASONING_MODEL_RE.test(model);
}

export function buildReasoningArgs(model: string): Partial<StreamChatParams> {
  if (isReasoningModel(model)) {
    return { temperature: undefined };
  }
  return {};
}

// Only the original o1 family rejects system role; o3+, o4, and gpt-5 accept it.
export function requiresNoSystemRole(model: string): boolean {
  return /^(openai\/)?o1(-|$)/i.test(model);
}

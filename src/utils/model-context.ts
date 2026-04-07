/**
 * Model context window detection.
 *
 * Maps known model IDs to their context window sizes.
 * Falls back to a conservative default for unknown models.
 */

const DEFAULT_CONTEXT_WINDOW = 128_000;

/** Known model patterns → context window tokens */
const MODEL_CONTEXT_WINDOWS: Array<{ pattern: string; tokens: number }> = [
  // Anthropic Claude
  { pattern: 'claude-opus-4', tokens: 200_000 },
  { pattern: 'claude-sonnet-4', tokens: 200_000 },
  { pattern: 'claude-haiku-4', tokens: 200_000 },
  { pattern: 'claude-3.5-sonnet', tokens: 200_000 },
  { pattern: 'claude-3-opus', tokens: 200_000 },
  { pattern: 'claude-3-sonnet', tokens: 200_000 },
  { pattern: 'claude-3-haiku', tokens: 200_000 },

  // OpenAI GPT-4
  { pattern: 'gpt-4o', tokens: 128_000 },
  { pattern: 'gpt-4-turbo', tokens: 128_000 },
  { pattern: 'gpt-4-0125', tokens: 128_000 },
  { pattern: 'gpt-4-1106', tokens: 128_000 },

  // OpenAI o1/o3
  { pattern: 'o1', tokens: 200_000 },
  { pattern: 'o3', tokens: 200_000 },

  // Google Gemini
  { pattern: 'gemini-2', tokens: 1_000_000 },
  { pattern: 'gemini-1.5-pro', tokens: 1_000_000 },
  { pattern: 'gemini-1.5-flash', tokens: 1_000_000 },

  // DeepSeek
  { pattern: 'deepseek-chat', tokens: 128_000 },
  { pattern: 'deepseek-r1', tokens: 128_000 },

  // Mistral
  { pattern: 'mistral-large', tokens: 128_000 },
  { pattern: 'mistral-medium', tokens: 32_000 },
];

/**
 * Get the context window size for a model.
 *
 * @param modelId — full model ID (e.g. "anthropic/claude-sonnet-4-20250514")
 * @param override — optional explicit override (takes precedence)
 */
export function getModelContextWindow(modelId: string, override?: number): number {
  if (override !== undefined) return override;

  for (const entry of MODEL_CONTEXT_WINDOWS) {
    if (modelId.includes(entry.pattern)) return entry.tokens;
  }

  return DEFAULT_CONTEXT_WINDOW;
}

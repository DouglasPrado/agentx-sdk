/** Thrown when the API returns 413 — prompt exceeds context window */
export class PromptTooLongError extends Error {
  constructor(message = 'Prompt too long') {
    super(message);
    this.name = 'PromptTooLongError';
  }
}

/** Thrown when the API returns 529 or 503 — model overloaded */
export class OverloadedError extends Error {
  constructor(message = 'Model overloaded') {
    super(message);
    this.name = 'OverloadedError';
  }
}

/** Thrown when the API returns 402 — insufficient credits/billing */
export class InsufficientCreditsError extends Error {
  constructor(message = 'Insufficient credits') {
    super(message);
    this.name = 'InsufficientCreditsError';
  }
}

/** Classify an API error thrown from fetchAPI */
export function classifyAPIError(error: unknown): unknown {
  if (error instanceof PromptTooLongError || error instanceof OverloadedError || error instanceof InsufficientCreditsError) {
    return error;
  }
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes('402')) return new InsufficientCreditsError(msg);
    if (msg.includes('413')) return new PromptTooLongError(msg);
    if (msg.includes('529') || (msg.includes('503') && msg.toLowerCase().includes('overload'))) {
      return new OverloadedError(msg);
    }
  }
  return error;
}

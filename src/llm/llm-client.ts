import type {
  StreamChatParams,
  ChatParams,
  StreamChunk,
  ChatResponse,
  LLMToolCall,
} from './message-types.js';
import type { TokenUsage } from '../contracts/entities/token-usage.js';
import { retry } from '../utils/retry.js';
import { buildReasoningArgs, isReasoningModel, requiresNoSystemRole } from './reasoning.js';
import { validateSsrfUrl } from '../utils/ssrf-guard.js';

export interface LLMClientConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

const MAX_ERROR_BODY = 500;

function sanitizeErrorBody(text: string): string {
  const truncated =
    text.length > MAX_ERROR_BODY ? `${text.slice(0, MAX_ERROR_BODY)}... [truncated]` : text;
  try {
    const parsed = JSON.parse(truncated) as { error?: { message?: unknown }; message?: unknown };
    const msg = parsed.error?.message ?? parsed.message;
    if (typeof msg === 'string') return msg.slice(0, MAX_ERROR_BODY);
  } catch {
    /* not JSON — return truncated plain text */
  }
  return truncated;
}

/**
 * LLMClient performs automatic retry on RetryableError (HTTP 429 / 5xx).
 * Non-idempotent POST requests to /chat/completions and /embeddings are retried
 * only when the server signals rate-limit or server-side failure, where the
 * request typically did not complete processing. Other failures (4xx) are not
 * retried. Callers that need strict at-most-once semantics should pass their
 * own signal and handle failures at the call site.
 */
export class LLMClient {
  /** Default request timeout when caller provides no AbortSignal. */
  private static readonly DEFAULT_TIMEOUT_MS = 120_000;

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: LLMClientConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    const rawBase = (config.baseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    const ssrfError = validateSsrfUrl(rawBase);
    if (ssrfError) throw new Error(`baseUrl bloqueada (SSRF): ${ssrfError}`);
    this.baseUrl = rawBase;
    this.timeoutMs = config.timeoutMs ?? LLMClient.DEFAULT_TIMEOUT_MS;
  }

  /**
   * Monta o body do POST /chat/completions e dispara a request com retry.
   * Compartilhado entre streamChat() e chat() — única diferença é o `stream` flag
   * e o `stream_options` que streamChat injeta.
   */
  private async sendChatRequest(params: StreamChatParams, streaming: boolean): Promise<Response> {
    const model = params.model ?? this.model;
    const reasoningArgs = buildReasoningArgs(model);

    let messages = params.messages;
    if (requiresNoSystemRole(model)) {
      messages = messages.map((m) => (m.role === 'system' ? { ...m, role: 'user' as const } : m));
    }

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: streaming,
      ...reasoningArgs,
    };

    // OpenAI-compatible providers (OpenAI, OpenRouter, LiteLLM, vLLM) only emit
    // usage on the SSE stream when this flag is set. Without it, the final chunk
    // has finish_reason but no token counts — costs cannot be computed downstream.
    if (streaming) body.stream_options = { include_usage: true };

    if (params.tools?.length) body.tools = params.tools;
    if (params.temperature !== undefined) body.temperature = params.temperature;
    if (params.responseFormat) body.response_format = params.responseFormat;
    if (params.seed !== undefined) body.seed = params.seed;
    if (params.maxTokens !== undefined) {
      if (isReasoningModel(model)) body.max_completion_tokens = params.maxTokens;
      else body.max_tokens = params.maxTokens;
    }

    return retry(() => this.fetchAPI('/chat/completions', body, params.signal), {
      maxRetries: 3,
      initialDelay: 1000,
      isRetryable: (e) => e instanceof RetryableError,
    });
  }

  async *streamChat(params: StreamChatParams): AsyncIterableIterator<StreamChunk> {
    const response = await this.sendChatRequest(params, true);
    yield* this.parseSSEStream(response, params.signal);
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const response = await this.sendChatRequest(params, false);

    interface ChatJson {
      choices: {
        message: { content?: string; tool_calls?: LLMToolCall[] };
        finish_reason: string;
      }[];
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    }
    let json: ChatJson;
    try {
      json = (await response.json()) as ChatJson;
    } catch (e) {
      // Ensure body is fully consumed so the HTTP connection is returned to the pool
      await response.body?.cancel().catch(() => {
        /* swallow — already in error path */
      });
      throw new Error(
        `Failed to parse LLM response: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const choice = json.choices?.[0];
    if (!choice) {
      throw new Error(
        `LLM API returned empty choices (model=${this.model}). Response: ${JSON.stringify(json).slice(0, 200)}`,
      );
    }
    const usage: TokenUsage = {
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
      totalTokens: json.usage?.total_tokens ?? 0,
    };

    return {
      content: choice.message.content ?? '',
      toolCalls: choice.message.tool_calls,
      finishReason: choice.finish_reason,
      usage,
    };
  }

  async embed(texts: string[], model?: string): Promise<number[][]> {
    const response = await retry(
      () =>
        this.fetchAPI('/embeddings', {
          model: model ?? this.model,
          input: texts,
        }),
      { maxRetries: 3, initialDelay: 1000, isRetryable: (e) => e instanceof RetryableError },
    );

    interface EmbedJson {
      data: { embedding: number[] }[];
    }
    let json: EmbedJson;
    try {
      json = (await response.json()) as EmbedJson;
    } catch (e) {
      await response.body?.cancel().catch(() => {
        /* swallow — already in error path */
      });
      throw new Error(
        `Failed to parse LLM response: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return json.data.map((d) => d.embedding);
  }

  private async fetchAPI(
    path: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<Response> {
    // Always apply a default timeout; compose with the caller-provided signal if any.
    const signals: AbortSignal[] = [AbortSignal.timeout(this.timeoutMs)];
    if (signal) signals.push(signal);
    const effectiveSignal = AbortSignal.any(signals);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: effectiveSignal,
    });

    if (!response.ok) {
      if (isRetryableStatus(response.status)) {
        // Parse Retry-After header (seconds or HTTP-date)
        let retryAfterMs: number | undefined;
        const retryAfter = response.headers.get('retry-after');
        if (retryAfter) {
          const seconds = Number(retryAfter);
          retryAfterMs = Number.isNaN(seconds)
            ? Math.max(0, new Date(retryAfter).getTime() - Date.now())
            : seconds * 1000;
        }
        throw new RetryableError(`LLM API error: ${response.status}`, retryAfterMs);
      }
      const text = await response.text().catch(() => '');
      throw new Error(`LLM API error ${response.status}: ${sanitizeErrorBody(text)}`);
    }

    return response;
  }

  private async *parseSSEStream(
    response: Response,
    signal?: AbortSignal,
  ): AsyncIterableIterator<StreamChunk> {
    const body = response.body;
    if (!body) throw new Error('Response body is null');

    const reader = (body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Accumulate tool calls incrementally
    const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();

    // Defer the `done` event until end-of-stream. With stream_options.include_usage,
    // OpenAI-compatible providers send usage in a SEPARATE chunk (with empty choices)
    // AFTER the chunk that carried finish_reason. If we emitted `done` on
    // finish_reason like before, we'd race ahead of the usage chunk and lose it.
    let pendingFinishReason: string | undefined;
    let pendingUsage: TokenUsage | undefined;
    let donePending = false;

    // Propagate abort to the reader so a hanging read() is unblocked immediately.
    const abortHandler = (): void => {
      void reader.cancel().catch(() => {
        /* swallow — abort path */
      });
    };
    if (signal) {
      if (signal.aborted) abortHandler();
      else signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      streamLoop: while (true) {
        if (signal?.aborted) break;

        const { done, value } = await reader.read();
        if (done) {
          // Flush any pending multibyte bytes held in the decoder
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);

          if (data === '[DONE]') {
            break streamLoop;
          }

          let parsed: SSEPayload;
          try {
            parsed = JSON.parse(data) as SSEPayload;
          } catch {
            continue;
          }

          // Capture usage from any chunk — when stream_options.include_usage is set
          // it usually arrives on its own chunk with choices=[].
          if (parsed.usage) {
            pendingUsage = {
              inputTokens: parsed.usage.prompt_tokens,
              outputTokens: parsed.usage.completion_tokens,
              totalTokens: parsed.usage.total_tokens,
            };
          }

          const choice = parsed.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;

          // Text content
          if (delta?.content) {
            yield { type: 'content', data: delta.content };
          }

          // Reasoning content
          if (delta?.reasoning) {
            yield { type: 'reasoning', data: delta.reasoning };
          }

          // Tool calls (accumulated incrementally)
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const existing = toolCalls.get(tc.index);
              if (!existing) {
                const entry = {
                  id: tc.id ?? '',
                  name: tc.function?.name ?? '',
                  arguments: tc.function?.arguments ?? '',
                };
                toolCalls.set(tc.index, entry);
              } else {
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name += tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              }
            }
          }

          if (choice.finish_reason) {
            pendingFinishReason = choice.finish_reason;
            donePending = true;
          }
        }
      }

      if (donePending) {
        for (const tc of toolCalls.values()) {
          yield { type: 'tool_call', id: tc.id, name: tc.name, arguments: tc.arguments };
        }
        yield { type: 'done', finishReason: pendingFinishReason ?? 'stop', usage: pendingUsage };
      }
    } finally {
      if (signal) signal.removeEventListener('abort', abortHandler);
      reader.releaseLock();
    }
  }
}

class RetryableError extends Error {
  retryAfterMs?: number;

  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'RetryableError';
    this.retryAfterMs = retryAfterMs;
  }
}

interface SSEPayload {
  choices?: {
    delta?: {
      content?: string;
      reasoning?: string;
      tool_calls?: {
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

import type { LLMClient } from '../llm/llm-client.js';
import { LRUCache } from '../utils/cache.js';

/**
 * Generates embeddings via LLM API with LRU caching.
 */
export class EmbeddingService {
  private readonly client: LLMClient;
  private readonly cache: LRUCache<string, number[]>;
  private readonly model?: string;

  constructor(client: LLMClient, options?: { model?: string; cacheSize?: number }) {
    this.client = client;
    this.model = options?.model;
    this.cache = new LRUCache<string, number[]>({
      maxSize: options?.cacheSize ?? 10_000,
      ttl: 3_600_000,
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    const results: number[][] = new Array<number[]>(texts.length);
    const uncached: { index: number; text: string }[] = [];

    // Check cache
    for (let i = 0; i < texts.length; i++) {
      const cached = this.cache.get(texts[i]!);
      if (cached) {
        results[i] = cached;
      } else {
        uncached.push({ index: i, text: texts[i]! });
      }
    }

    // Fetch uncached
    if (uncached.length > 0) {
      const uncachedTexts = uncached.map((u) => u.text);
      const embeddings = await this.client.embed(uncachedTexts, this.model);

      if (embeddings.length !== uncached.length) {
        throw new Error(
          `EmbeddingService: provider returned ${embeddings.length} embeddings ` +
            `but ${uncached.length} were requested (model=${this.model})`,
        );
      }

      for (let i = 0; i < uncached.length; i++) {
        const entry = uncached[i]!;
        const embedding = embeddings[i];
        if (!embedding) {
          throw new Error(`EmbeddingService: missing embedding at index ${i}`);
        }
        results[entry.index] = embedding;
        this.cache.set(entry.text, embedding);
      }
    }

    return results;
  }

  async embedSingle(text: string): Promise<Float32Array> {
    const [result] = await this.embed([text]);
    return new Float32Array(result!);
  }
}

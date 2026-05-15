import { z } from 'zod';
import type { LLMClient } from '../llm/llm-client.js';
import type { LLMMessage } from '../llm/message-types.js';
import type { TokenUsage } from '../contracts/entities/token-usage.js';
import {
  EVALUATION_CRITERIA,
  EvaluationScoreSchema,
  aggregateScore,
  type Evaluation,
  type EvaluationCriterion,
  type EvaluationScore,
  type ScoreAggregation,
} from '../contracts/entities/evaluation.js';
import { buildJudgeSystemPrompt, buildJudgeUserPrompt } from './evaluation-prompts.js';

export interface EvaluatorConfig {
  judgeClient: LLMClient;
  judgeModel: string;
  criteria: EvaluationCriterion[];
  sampleRate: number;
  scoreAggregation?: ScoreAggregation;
  parseMaxRetries?: number;
  rng?: () => number;
  now?: () => number;
}

export interface EvaluateInput {
  traceId: string;
  threadId: string;
  turnIndex: number;
  userInput: string;
  assistantText: string;
  signal?: AbortSignal;
}

const JudgeOutputSchema = z.object({
  scores: z.array(EvaluationScoreSchema).min(1),
});

export class EvaluatorParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluatorParseError';
  }
}

export class Evaluator {
  private readonly client: LLMClient;
  private readonly judgeModel: string;
  private readonly criteria: readonly EvaluationCriterion[];
  private readonly sampleRate: number;
  private readonly aggregation: ScoreAggregation;
  private readonly parseMaxRetries: number;
  private readonly rng: () => number;
  private readonly now: () => number;

  constructor(config: EvaluatorConfig) {
    if (!Array.isArray(config.criteria) || config.criteria.length === 0) {
      throw new Error('Evaluator: criteria must be a non-empty array');
    }
    for (const c of config.criteria) {
      if (!(EVALUATION_CRITERIA as readonly string[]).includes(c)) {
        throw new Error(`Evaluator: unknown criterion "${c}"`);
      }
    }
    if (
      typeof config.sampleRate !== 'number' ||
      config.sampleRate < 0 ||
      config.sampleRate > 1 ||
      Number.isNaN(config.sampleRate)
    ) {
      throw new Error('Evaluator: sampleRate must be a number between 0 and 1');
    }
    if (!config.judgeModel || typeof config.judgeModel !== 'string') {
      throw new Error('Evaluator: judgeModel is required');
    }

    this.client = config.judgeClient;
    this.judgeModel = config.judgeModel;
    this.criteria = [...config.criteria];
    this.sampleRate = config.sampleRate;
    this.aggregation = config.scoreAggregation ?? 'mean';
    this.parseMaxRetries = config.parseMaxRetries ?? 1;
    this.rng = config.rng ?? Math.random;
    this.now = config.now ?? Date.now;
  }

  async evaluate(input: EvaluateInput): Promise<Evaluation | null> {
    if (this.sampleRate === 0) return null;
    if (this.sampleRate < 1 && this.rng() >= this.sampleRate) return null;

    const start = this.now();
    const systemPrompt = buildJudgeSystemPrompt(this.criteria);
    const userPrompt = buildJudgeUserPrompt(input.userInput, input.assistantText);
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const usage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let lastError: unknown;
    let scores: EvaluationScore[] | null = null;

    for (let attempt = 0; attempt <= this.parseMaxRetries; attempt += 1) {
      const response = await this.client.chat({
        model: this.judgeModel,
        messages,
        responseFormat: { type: 'json_object' },
        signal: input.signal,
        temperature: 0,
      });

      usage.inputTokens += response.usage.inputTokens;
      usage.outputTokens += response.usage.outputTokens;
      usage.totalTokens += response.usage.totalTokens;

      try {
        scores = this.parseAndValidate(response.content);
        break;
      } catch (err) {
        lastError = err;
        scores = null;
      }
    }

    if (!scores) {
      throw new EvaluatorParseError(
        `judge output failed validation after ${this.parseMaxRetries + 1} attempt(s): ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
      );
    }

    const finalScore = aggregateScore(scores, this.aggregation);
    const end = this.now();

    return {
      traceId: input.traceId,
      threadId: input.threadId,
      turnIndex: input.turnIndex,
      scores,
      finalScore,
      judgeModel: this.judgeModel,
      judgeUsage: usage,
      durationMs: Math.max(0, end - start),
      createdAt: new Date(start).toISOString(),
    };
  }

  private parseAndValidate(raw: string): EvaluationScore[] {
    const trimmed = stripCodeFences(raw).trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new EvaluatorParseError('judge output is not valid JSON');
    }

    const result = JudgeOutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new EvaluatorParseError(
        `judge output failed schema validation: ${result.error.issues[0]?.message ?? 'unknown'}`,
      );
    }

    const requested = new Set(this.criteria);
    const seen = new Set<EvaluationCriterion>();
    for (const s of result.data.scores) {
      if (!requested.has(s.criterion)) {
        throw new EvaluatorParseError(
          `judge produced score for non-requested criterion "${s.criterion}"`,
        );
      }
      if (seen.has(s.criterion)) {
        throw new EvaluatorParseError(`duplicate criterion in judge output: "${s.criterion}"`);
      }
      seen.add(s.criterion);
    }
    for (const c of this.criteria) {
      if (!seen.has(c)) {
        throw new EvaluatorParseError(`judge omitted requested criterion "${c}"`);
      }
    }

    return result.data.scores;
  }
}

const FENCE_RE = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i;

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = FENCE_RE.exec(trimmed);
  return match?.[1] ?? trimmed;
}

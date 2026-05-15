import type { SQLiteDatabase } from '../storage/sqlite-database.js';
import {
  EVALUATION_CRITERIA,
  type Evaluation,
  type EvaluationAggregate,
  type EvaluationCriterion,
  type EvaluationScore,
  type EvaluationStore,
} from '../contracts/entities/evaluation.js';

interface EvaluationRow {
  trace_id: string;
  thread_id: string;
  turn_index: number;
  judge_model: string;
  final_score: number;
  scores_json: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  duration_ms: number;
  created_at: string;
}

export class SQLiteEvaluationStore implements EvaluationStore {
  private readonly database: SQLiteDatabase;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  append(e: Evaluation): void {
    this.database.db
      .prepare(
        `INSERT INTO evaluations (
          trace_id, thread_id, turn_index, judge_model, final_score, scores_json,
          input_tokens, output_tokens, total_tokens, duration_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        e.traceId,
        e.threadId,
        e.turnIndex,
        e.judgeModel,
        e.finalScore,
        JSON.stringify(e.scores),
        e.judgeUsage.inputTokens,
        e.judgeUsage.outputTokens,
        e.judgeUsage.totalTokens,
        e.durationMs,
        e.createdAt,
      );
  }

  listByThread(threadId: string, limit?: number): Evaluation[] {
    const sql = limit
      ? 'SELECT * FROM evaluations WHERE thread_id = ? ORDER BY created_at DESC LIMIT ?'
      : 'SELECT * FROM evaluations WHERE thread_id = ? ORDER BY created_at DESC';
    const rows = (
      limit
        ? this.database.db.prepare(sql).all(threadId, limit)
        : this.database.db.prepare(sql).all(threadId)
    ) as EvaluationRow[];
    return rows.map(rowToEvaluation);
  }

  listByTrace(traceId: string): Evaluation[] {
    const rows = this.database.db
      .prepare('SELECT * FROM evaluations WHERE trace_id = ? ORDER BY created_at ASC')
      .all(traceId) as EvaluationRow[];
    return rows.map(rowToEvaluation);
  }

  aggregateByCriterion(sinceIso: string): Record<EvaluationCriterion, EvaluationAggregate> {
    const rows = this.database.db
      .prepare('SELECT scores_json FROM evaluations WHERE created_at >= ?')
      .all(sinceIso) as { scores_json: string }[];

    const acc: Record<EvaluationCriterion, { sum: number; n: number }> = {
      factuality: { sum: 0, n: 0 },
      coherence: { sum: 0, n: 0 },
      safety: { sum: 0, n: 0 },
      completeness: { sum: 0, n: 0 },
      helpfulness: { sum: 0, n: 0 },
    };

    for (const row of rows) {
      let scores: EvaluationScore[];
      try {
        scores = JSON.parse(row.scores_json) as EvaluationScore[];
      } catch {
        continue;
      }
      for (const s of scores) {
        const bucket = acc[s.criterion];
        if (!bucket) continue;
        bucket.sum += s.score;
        bucket.n += 1;
      }
    }

    const out = {} as Record<EvaluationCriterion, EvaluationAggregate>;
    for (const c of EVALUATION_CRITERIA) {
      const bucket = acc[c];
      out[c] = bucket.n === 0 ? { avg: 0, n: 0 } : { avg: bucket.sum / bucket.n, n: bucket.n };
    }
    return out;
  }
}

function rowToEvaluation(row: EvaluationRow): Evaluation {
  return {
    traceId: row.trace_id,
    threadId: row.thread_id,
    turnIndex: row.turn_index,
    scores: JSON.parse(row.scores_json) as EvaluationScore[],
    finalScore: row.final_score,
    judgeModel: row.judge_model,
    judgeUsage: {
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
    },
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

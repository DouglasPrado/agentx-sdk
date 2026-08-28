import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteDatabase } from '../../../src/storage/sqlite-database.js';
import { SQLiteEvaluationStore } from '../../../src/evaluation/sqlite-evaluation-store.js';
import type {
  Evaluation,
  EvaluationCriterion,
} from '../../../src/contracts/entities/evaluation.js';

function makeEval(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    traceId: 'trace-a',
    threadId: 'thread-a',
    turnIndex: 0,
    scores: [
      { criterion: 'factuality', score: 8, reasoning: 'r1' },
      { criterion: 'coherence', score: 7, reasoning: 'r2' },
    ],
    finalScore: 7.5,
    judgeModel: 'judge-x',
    judgeUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    durationMs: 1234,
    createdAt: '2026-05-15T12:00:00.000Z',
    ...overrides,
  };
}

describe('SQLiteEvaluationStore', () => {
  let db: SQLiteDatabase;
  let store: SQLiteEvaluationStore;

  beforeEach(() => {
    db = new SQLiteDatabase(':memory:');
    db.initialize();
    store = new SQLiteEvaluationStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it('persists an evaluation', () => {
    const e = makeEval();
    store.append(e);
    const got = store.listByTrace('trace-a');
    expect(got).toHaveLength(1);
    expect(got[0]!.finalScore).toBe(7.5);
    expect(got[0]!.scores).toHaveLength(2);
    expect(got[0]!.judgeModel).toBe('judge-x');
    expect(got[0]!.judgeUsage.totalTokens).toBe(150);
  });

  it('listByTrace filters by traceId', () => {
    store.append(makeEval({ traceId: 't1' }));
    store.append(makeEval({ traceId: 't2' }));
    store.append(makeEval({ traceId: 't1' }));
    expect(store.listByTrace('t1')).toHaveLength(2);
    expect(store.listByTrace('t2')).toHaveLength(1);
    expect(store.listByTrace('nonexistent')).toHaveLength(0);
  });

  it('listByThread returns ordered by created_at DESC', () => {
    store.append(makeEval({ traceId: 't1', createdAt: '2026-05-15T12:00:00.000Z' }));
    store.append(makeEval({ traceId: 't2', createdAt: '2026-05-15T12:00:02.000Z' }));
    store.append(makeEval({ traceId: 't3', createdAt: '2026-05-15T12:00:01.000Z' }));
    const got = store.listByThread('thread-a');
    expect(got.map((e) => e.traceId)).toEqual(['t2', 't3', 't1']);
  });

  it('listByThread respects limit', () => {
    for (let i = 0; i < 5; i += 1) {
      store.append(makeEval({ traceId: `t${i}`, createdAt: `2026-05-15T12:00:0${i}.000Z` }));
    }
    const got = store.listByThread('thread-a', 3);
    expect(got).toHaveLength(3);
  });

  it('aggregateByCriterion computes average and count since cutoff', () => {
    store.append(
      makeEval({
        traceId: 't1',
        createdAt: '2026-05-14T12:00:00.000Z',
        scores: [{ criterion: 'factuality', score: 4, reasoning: 'r' }],
        finalScore: 4,
      }),
    );
    store.append(
      makeEval({
        traceId: 't2',
        createdAt: '2026-05-15T12:00:00.000Z',
        scores: [
          { criterion: 'factuality', score: 8, reasoning: 'r' },
          { criterion: 'coherence', score: 6, reasoning: 'r' },
        ],
        finalScore: 7,
      }),
    );
    store.append(
      makeEval({
        traceId: 't3',
        createdAt: '2026-05-15T13:00:00.000Z',
        scores: [
          { criterion: 'factuality', score: 10, reasoning: 'r' },
          { criterion: 'coherence', score: 8, reasoning: 'r' },
        ],
        finalScore: 9,
      }),
    );

    const agg = store.aggregateByCriterion('2026-05-15T00:00:00.000Z');
    expect(agg.factuality.n).toBe(2);
    expect(agg.factuality.avg).toBe(9);
    expect(agg.coherence.n).toBe(2);
    expect(agg.coherence.avg).toBe(7);
  });

  it('aggregateByCriterion returns 0/0 for criteria with no rows', () => {
    store.append(makeEval());
    const agg = store.aggregateByCriterion('2026-05-15T00:00:00.000Z');
    const helpfulness = agg.helpfulness;
    expect(helpfulness.n).toBe(0);
    expect(helpfulness.avg).toBe(0);
  });

  it('round-trips scores array through JSON storage', () => {
    const scores = [
      { criterion: 'factuality' as EvaluationCriterion, score: 9, reasoning: 'r-fact' },
      { criterion: 'safety' as EvaluationCriterion, score: 10, reasoning: 'r-safe' },
    ];
    store.append(makeEval({ scores, finalScore: 9.5 }));
    const got = store.listByTrace('trace-a')[0]!;
    expect(got.scores).toEqual(scores);
  });
});

/**
 * Cosine similarity entre dois vetores. Clampa o resultado em [0, 1] —
 * vetores em direções opostas são tratados como "não similares" (score 0)
 * em vez de retornar negativo. Casa com os usos atuais (RAG ranking,
 * skill matching) que comparam contra um minScore não-negativo.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return Math.max(0, Math.min(1, dot / denom));
}

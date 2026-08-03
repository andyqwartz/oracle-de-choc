// src/rag/retrieve.ts
// Brute-force cosine similarity over the compact index.
// For ~5-8k chunks × 384 dims this is a handful of ms — no need for a vector DB.

import { embedQuery } from './embedQuery';
import type { CompactIndex } from './loadIndex';
import type { RagChunk } from '../types';

export async function retrieve(
  idx: CompactIndex,
  query: string,
  topK: number,
  episode?: string | null
): Promise<RagChunk[]> {
  const q = await embedQuery(query);
  const { docs, emb, dim } = idx;
  const n = docs.length;

  // Precompute query norm once.
  let qNorm = 0;
  for (let i = 0; i < dim; i++) qNorm += q[i] * q[i];
  qNorm = Math.sqrt(qNorm) || 1;

  const scores: { i: number; s: number }[] = [];

  for (let d = 0; d < n; d++) {
    if (episode && docs[d].episode !== episode) continue;
    const base = d * dim;
    let dot = 0;
    let norm = 0;
    for (let k = 0; k < dim; k++) {
      const v = emb[base + k];
      dot += q[k] * v;
      norm += v * v;
    }
    const cos = dot / (qNorm * (Math.sqrt(norm) || 1));
    // Avoid negative scores; clamp minimum at 0 for ranking stability.
    scores.push({ i: d, s: Math.max(0, cos) });
  }

  // Partial top-K (scores are small; full sort is fine for ~8k items).
  scores.sort((a, b) => b.s - a.s);
  const top = scores.slice(0, topK);

  return top.map(({ i, s }) => ({
    content: docs[i].content,
    episode: docs[i].episode,
    score: s,
  }));
}

export function buildContextBlock(chunks: RagChunk[]): string {
  return chunks
    .map((chunk) => `[Épisode : ${chunk.episode}]\n${chunk.content}`)
    .join('\n\n');
}

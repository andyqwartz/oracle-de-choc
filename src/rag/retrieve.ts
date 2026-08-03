// src/rag/retrieve.ts
import { search } from '@orama/orama';
import type { AnyOrama } from '@orama/orama';
import { embedQuery } from './embedQuery';
import type { RagChunk } from '../types';

export async function retrieve(db: AnyOrama, query: string, topK: number): Promise<RagChunk[]> {
  const embedding = await embedQuery(query);

  const results = await search(db, {
    mode: 'vector',
    vector: { value: embedding, property: 'embedding' },
    // Orama's default similarity threshold (~0.8) filters out real results —
    // MiniLM-384 cosine scores sit around 0.4–0.6. Let topK decide instead.
    similarity: 0,
    limit: topK,
  });

  return results.hits.map((hit: any) => ({
    content: hit.document.content,
    episode: hit.document.episode,
    score: hit.score,
  }));
}

export function buildContextBlock(chunks: RagChunk[]): string {
  return chunks
    .map((chunk) => `[Épisode : ${chunk.episode}]\n${chunk.content}`)
    .join('\n\n');
}

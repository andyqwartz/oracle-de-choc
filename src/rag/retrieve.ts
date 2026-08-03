// src/rag/retrieve.ts
// searchVector + context block builder.

import { searchVector } from '@orama/orama';
import type { Orama } from '@orama/orama';
import { embedQuery } from './embedQuery';
import type { RagChunk } from '../types';

export async function retrieve(db: Orama, query: string, topK: number): Promise<RagChunk[]> {
  const embedding = await embedQuery(query);

  const results = await searchVector(db, {
    vector: { value: embedding, property: 'embedding' },
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

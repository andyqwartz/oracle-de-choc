// src/rag/embedQuery.ts
// Singleton embedding pipeline for the browser.
// Loads Xenova/all-MiniLM-L6-v2 once and reuses it for every query.

import { pipeline } from '@huggingface/transformers';
import { CONFIG } from '../config';

let _pipeline: any = null;

export async function embedQuery(text: string): Promise<number[]> {
  if (_pipeline === null) {
    _pipeline = await pipeline('feature-extraction', CONFIG.embeddingModel, {
      pooling: 'mean',
      normalize: true,
    });
  }

  const result = await _pipeline(text, { pooling: 'mean', normalize: true });
  const vector = Array.isArray(result) ? result : Array.from(result as unknown as number[]);
  return vector;
}

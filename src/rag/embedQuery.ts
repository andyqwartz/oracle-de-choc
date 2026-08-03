// src/rag/embedQuery.ts
import { pipeline } from '@huggingface/transformers';
import { CONFIG } from '../config';

let _pipeline: any = null;

export async function embedQuery(text: string): Promise<number[]> {
  if (_pipeline === null) {
    _pipeline = await pipeline('feature-extraction', CONFIG.embeddingModel);
  }

  const result = await _pipeline(text, { pooling: 'mean', normalize: true });
  // transformers.js returns a Tensor; its flat data (typed array) is the 384-dim vector.
  // Must pool (mean) + normalize exactly like build-index.mjs, else we get per-token vectors.
  const vector = Array.isArray(result) ? result : Array.from(result.data);
  return vector;
}

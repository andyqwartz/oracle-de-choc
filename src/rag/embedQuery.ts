// src/rag/embedQuery.ts
import { pipeline } from '@huggingface/transformers';
import { CONFIG } from '../config';

let _pipeline: any = null;

export async function embedQuery(text: string): Promise<number[]> {
  if (_pipeline === null) {
    _pipeline = await pipeline('feature-extraction', CONFIG.embeddingModel);
  }

  const result = await _pipeline(text);
  const vector = Array.isArray(result) ? result : Array.from(result as unknown as number[]);
  return vector;
}

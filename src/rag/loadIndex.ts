// src/rag/loadIndex.ts
import { CONFIG } from '../config';
import { restore } from '@orama/plugin-data-persistence';
import type { Orama } from '@orama/orama';

export async function loadIndex(): Promise<Orama<any>> {
  const metaRes = await fetch(CONFIG.indexMetaUrl);
  if (!metaRes.ok) {
    throw new Error(`Failed to fetch index meta: ${metaRes.status} ${metaRes.statusText}`);
  }
  const meta = await metaRes.json();

  if (meta.embeddingModel !== CONFIG.embeddingModel) {
    throw new Error(
      `Embedding model mismatch: expected "${CONFIG.embeddingModel}", ` +
      `got "${meta.embeddingModel}". Rebuild the index with the correct model.`
    );
  }

  const indexRes = await fetch(CONFIG.indexUrl);
  if (!indexRes.ok) {
    throw new Error(`Failed to fetch index: ${indexRes.status} ${indexRes.statusText}`);
  }
  const indexData = await indexRes.json();

  const db = await restore('json', indexData);
  return db;
}

// src/rag/loadIndex.ts
// Fetches the pre-built index JSON from the public directory (or HF dataset URL),
// validates the embedding model, restores Orama in memory.

import { CONFIG } from '../config';
import { restore } from '@orama/plugin-data-persistence';
import type { Orama } from '@orama/orama';

export async function loadIndex(): Promise<Orama> {
  // Fetch meta first to validate
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

  // Fetch the full index JSON
  const indexRes = await fetch(CONFIG.indexUrl);
  if (!indexRes.ok) {
    throw new Error(`Failed to fetch index: ${indexRes.status} ${indexRes.statusText}`);
  }
  const indexData = await indexRes.json();

  // Restore Orama from JSON
  const db = await restore('json', indexData);
  return db;
}

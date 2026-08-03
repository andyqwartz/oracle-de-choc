// src/rag/loadIndex.ts
// Loads the COMPACT vector index:
//   - chunks.json      : [{ content, episode }]
//   - embeddings.bin   : raw Float32Array (dim * count)
// The old @orama/orama JSON dump was ~200 MB and forced the browser to JSON.parse
// it on every load (hard freeze). This compact form loads near-instantly.

import { CONFIG } from '../config';

export interface CompactDoc {
  content: string;
  episode: string;
}

export interface CompactIndex {
  docs: CompactDoc[];
  emb: Float32Array; // dim * docs.length
  dim: number;
}

async function fetchOK(url: string, label: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${label} introuvable (${res.status}). Lance d'abord: npm run build-index`);
  }
  return res;
}

export async function loadIndex(): Promise<CompactIndex> {
  const metaRes = await fetchOK(CONFIG.indexMetaUrl, 'Index meta');
  const meta = await metaRes.json();

  if (meta.embeddingModel !== CONFIG.embeddingModel) {
    throw new Error(
      `Embedding model mismatch: expected "${CONFIG.embeddingModel}", got "${meta.embeddingModel}". Rebuild.`
    );
  }
  const dim = meta.dim || CONFIG.embeddingDim;
  const chunkCount = meta.chunkCount || 0;

  const [chunksRes, embRes] = await Promise.all([
    fetchOK(CONFIG.chunksUrl, 'Index (chunks)'),
    fetchOK(CONFIG.embeddingsUrl, 'Index (embeddings)'),
  ]);

  const docs = (await chunksRes.json()) as CompactDoc[];
  const buf = await embRes.arrayBuffer();
  const emb = new Float32Array(buf);

  // Sanity check: emb byte length must equal dim * docs.length * 4.
  if (dim > 0 && emb.length !== dim * docs.length) {
    throw new Error(
      `Index invalide: ${docs.length} chunks mais ${emb.length} floats (attendu ${dim * docs.length}). Rebuild.`
    );
  }

  return { docs, emb, dim };
}

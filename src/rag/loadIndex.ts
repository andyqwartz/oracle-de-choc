// src/rag/loadIndex.ts
// Chargement de l'index vectoriel pré-construit.
// NB : on utilise save/load d'@orama/orama directement (pas @orama/plugin-data-persistence),
// car ce plugin pull `dpack`, qui étend le stream Node `Transform` → crash en navigateur
// ("Class extends value undefined"). Le format 'json' du plugin n'était que JSON.stringify(save(db)).
import { CONFIG } from '../config';
import { create, load } from '@orama/orama';

export async function loadIndex() {
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
    throw new Error(`Index introuvable (${indexRes.status}). Lance d'abord: npm run build-index`);
  }
  const raw = await indexRes.text();
  let indexData;
  try {
    indexData = JSON.parse(raw);
  } catch {
    throw new Error(
      `Index invalide ou absent (${CONFIG.indexUrl}). ` +
      `Vérifie que data/transcripts/ contient des fichiers et lance: npm run build-index`
    );
  }

  // Orama `load` ne reconstruit pas lui-même l'instance : il faut créér un db vide
  // (même schéma que build-index) puis y charger la sérialisation.
  const db = await create({
    schema: {
      content: 'string',
      embedding: 'vector[384]',
      episode: 'string',
      chunkIndex: 'number',
    },
  });

  load(db, indexData);
  return db;
}

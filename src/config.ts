// Config.ts — central constants, single source of truth for model names and paths.
// Change these when swapping models or repos.

const isDev = import.meta.env?.DEV === true;

export const HF_INDEX_REPO = 'AndyVampiro/oracle-de-choc-index-v2';

const HF_BASE = `https://huggingface.co/datasets/${HF_INDEX_REPO}/resolve/main`;

export const CONFIG = {
  // LLM model on Hugging Face Hub
  llmRepo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
  llmFile: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',

  // Embedding model (used in build-index.mjs AND in the browser)
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  embeddingDim: 384,

  // RAG index. COMPACT format (chunks.json + embeddings.bin) — the old single
  // 200 MB oracle-index.json JSON forced a hard freeze on load, so it's gone.
  // In dev, use the local copies for speed; in prod, load from Hugging Face.
  indexMetaUrl: isDev
    ? '/oracle-de-choc/index/oracle-index.meta.json'
    : `${HF_BASE}/oracle-index.meta.json`,
  chunksUrl: isDev
    ? '/oracle-de-choc/index/chunks.json'
    : `${HF_BASE}/chunks.json`,
  embeddingsUrl: isDev
    ? '/oracle-de-choc/index/embeddings.bin'
    : `${HF_BASE}/embeddings.bin`,

  // Episode list (small, shipped with the app itself — also mirrored on HF).
  episodesUrl: '/oracle-de-choc/index/episodes.json',
} as const;

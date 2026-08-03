// Config.ts — central constants, single source of truth for model names and paths.
// Change these when swapping models or repos.

const isDev = import.meta.env?.DEV === true;

export const HF_INDEX_REPO = 'AndyVampiro/oracle-de-choc-index';

export const CONFIG = {
  // LLM model on Hugging Face Hub
  llmRepo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
  llmFile: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',

  // Embedding model (used in build-index.mjs AND in the browser)
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  embeddingDim: 384,

  // RAG index location. The built index (~200 MB) is too large for git/GitHub Pages,
  // so it lives on a Hugging Face dataset. In dev, prefer the local copy for speed.
  indexUrl: isDev
    ? '/oracle-de-choc/index/oracle-index.json'
    : `https://huggingface.co/datasets/${HF_INDEX_REPO}/resolve/main/oracle-index.json`,
  indexMetaUrl: isDev
    ? '/oracle-de-choc/index/oracle-index.meta.json'
    : `https://huggingface.co/datasets/${HF_INDEX_REPO}/resolve/main/oracle-index.meta.json`,

  // Episode list (small, shipped with the app itself — also mirrored on HF).
  episodesUrl: '/oracle-de-choc/index/episodes.json',

  // Chunking parameters (must match build-index.mjs exactly)
  chunkSize: 350,
  chunkOverlap: 60,
} as const;

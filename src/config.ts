// Config.ts — central constants, single source of truth for model names and paths.
// Change these when swapping models or repos.

export const CONFIG = {
  // LLM model on Hugging Face Hub
  llmRepo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
  llmFile: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',

  // Embedding model (used in build-index.mjs AND in the browser)
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  embeddingDim: 384,

  // RAG index location — public URL at runtime, or HF dataset URL if index ≥ 50 MB
  indexUrl: '/oracle-de-choc/index/oracle-index.json',
  indexMetaUrl: '/oracle-de-choc/index/oracle-index.meta.json',

  // Chunking parameters (must match build-index.mjs exactly)
  chunkSize: 350,
  chunkOverlap: 60,
} as const;

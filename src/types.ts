// types.ts — shared types used across the entire codebase.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface RagChunk {
  content: string;
  episode: string;
  score?: number;
}

export interface GenerationParams {
  temperature: number;
  top_k: number;
  top_p: number;
  repeat_penalty: number;
  n_predict: number;
  n_ctx: number;
}

export interface EpisodeInfo {
  id: string;
  filename: string;
}

export interface IndexMeta {
  embeddingModel: string;
  dim: number;
  chunkSize: number;
  chunkOverlap: number;
  builtAt: string;
  chunkCount: number;
  episodeCount: number;
}

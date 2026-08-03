// src/rag/episodes.ts
import { CONFIG } from '../config';

export async function loadEpisodes(): Promise<string[]> {
  try {
    const res = await fetch(CONFIG.episodesUrl);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((e: any) => (typeof e === 'string' ? e : e?.id)).filter(Boolean);
  } catch {
    return [];
  }
}

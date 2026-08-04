// src/llm/hf.ts
// Hugging Face catalog helpers for the model picker.
//   - ggufFileSize(repo, file): size in bytes of a specific GGUF file
//   - searchGgufModels(query, maxBytes): search HF, return light GGUF candidates
//     that wllama (llama.cpp WASM) can realistically run in the browser.
//
// wllama is a WebAssembly binding for llama.cpp: any GGUF that llama.cpp
// supports is loadable (Qwen, Llama, Mistral, Gemma, Phi, TinyLlama, etc.).
// The hard constraint in a browser is FILE SIZE / memory, so we filter to small
// GGUFs. The API search filter `filter=gguf` bounds results to GGUF repos.

export interface HfModelCandidate {
  repo: string;   // e.g. "Qwen/Qwen2.5-1.5B-Instruct-GGUF"
  file: string;   // the GGUF file inside the repo
  label: string;  // human name
  sizeBytes: number;
}

const HF_API = 'https://huggingface.co/api/models';
const resolve = 'https://huggingface.co';

// Keep results light enough to run in the browser (Q4_K_M 3B ≈ ~2 GB) and
// memory-safe in WASM. 7B+ quantized models are excluded by this cap.
export const DEFAULT_MAX_BYTES = 2.2 * 1024 * 1024 * 1024; // 2.2 GB

/**
 * Jackpot filter: real GGUF chat-model files, light + flat (no subdir), with a
 * standard quant marker. Rejects vision mmproj, split files, calibration/imatrix
 * junk and toy stories files.
 */
function isWantedFile(name: string): boolean {
  const n = name.toLowerCase();
  if (!n.endsWith('.gguf')) return false;
  // No subdirectory paths (wllama loads from the repo root).
  if (n.includes('/')) return false;
  // Standard quant markers only (q2_k … q8_0), excluding imatrix/i1/iq1 junk.
  if (!/q[234568]_/.test(n)) return false;
  // Reject calibration / imatrix / toy files.
  if (/imatrix/.test(n)) return false;
  // Reject vision projector and split archives.
  if (/mmproj/.test(n)) return false;
  if (/0000\d-of-\d+/i.test(n)) return false;
  return true;
}

/** Size in bytes of a specific GGUF file in repo, or null if not found. */
export async function ggufFileSize(repo: string, file: string): Promise<number | null> {
  try {
    const res = await fetch(`${resolve}/${repo}/resolve/main/${file}`, { method: 'HEAD' });
    const len = Number(res.headers.get('content-length') || '0');
    return len > 0 ? len : null;
  } catch {
    return null;
  }
}

/**
 * Search Hugging Face for light, browser-friendly GGUF models.
 * Uses the models search API (filter=gguf), fetches each repo's file list,
 * picks the smallest wanted GGUF file, and keeps only those under maxBytes.
 */
export async function searchGgufModels(
  query: string,
  maxBytes: number = DEFAULT_MAX_BYTES,
  limit = 8
): Promise<HfModelCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `${HF_API}?search=${encodeURIComponent(trimmed)}&filter=gguf&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Recherche HF impossible (' + res.status + ')');
  const repos: { id: string }[] = await res.json();

  // Fetch file lists for the candidate repos in parallel (bounded).
  const candidates: HfModelCandidate[] = [];
  const results = await Promise.allSettled(
    repos.map(async (r) => {
      // encodeURIComponent would turn '/' into %2F, which the HF API rejects.
      // Encode each path segment separately and rejoin with '/'.
      const repoPath = r.id.split('/').map(encodeURIComponent).join('/');
      // blobs=true makes each sibling carry its byte `size`.
      const detail = await fetch(`${HF_API}/${repoPath}?blobs=true`);
      if (!detail.ok) return null;
      const data = await detail.json();
      const files: { rfilename: string; size: number }[] = data.siblings ?? [];
      const wanted = files
        .filter((f) => isWantedFile(f.rfilename))
        .sort((a, b) => a.size - b.size);
      if (wanted.length === 0) return null;
      const best = wanted[0];
      if (best.size <= 0 || best.size > maxBytes) return null;
      return {
        repo: r.id,
        file: best.rfilename,
        label: best.rfilename.replace(/\.gguf$/i, ''),
        sizeBytes: best.size,
      } as HfModelCandidate;
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) candidates.push(r.value);
  }

  // Sort lightest first so the user sees the most browser-friendly options.
  return candidates.sort((a, b) => a.sizeBytes - b.sizeBytes);
}

export function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' Go';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(0) + ' Mo';
  return bytes + ' o';
}

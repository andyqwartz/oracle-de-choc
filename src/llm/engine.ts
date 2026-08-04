// src/llm/engine.ts
// Public API for the rest of the app. Encapsulates the Web Worker
// and exposes init(), generate(), abort().

import type { ChatMessage, GenerationParams, ModelStatus } from '../types';
import { getSettings } from '../settings/store';
import { resolveModel } from '../config';

interface WorkerMessage {
  type: string;
  id?: string;
  loaded?: number;
  total?: number;
  text?: string;
  message?: string;
  status?: ModelStatus;
  count?: number;
  freedBytes?: number;
}

let worker: Worker | null = null;
let pendingResolve: ((value: void) => void) | null = null;
let currentGenerateId: string | null = null;

function getWorker(): Worker {
  if (worker === null) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

export type ModelStatusCallback = (status: ModelStatus) => void;
export type ProgressCallback = (loaded: number, total: number) => void;

export async function initEngine(
  onStatus: ModelStatusCallback,
  onProgress: ProgressCallback
): Promise<void> {
  const w = getWorker();

  return new Promise<void>((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as WorkerMessage;

      switch (msg.type) {
        case 'model-status':
          // Worker posts flat fields: { state, phase, progress, loadedMB, totalMB }
          onStatus({
            state: (msg as any).state ?? 'idle',
            progress: (msg as any).progress ?? 0,
            loadedMB: (msg as any).loadedMB,
            totalMB: (msg as any).totalMB,
            phase: (msg as any).phase,
          });
          break;

        case 'progress':
          onProgress(msg.loaded ?? 0, msg.total ?? 1);
          break;

        case 'ready':
          w.removeEventListener('message', handler);
          resolve();
          break;

        case 'error':
          w.removeEventListener('message', handler);
          reject(new Error(msg.message ?? 'Unknown worker error'));
          break;
      }
    };

    w.addEventListener('message', handler);
    // Pass n_ctx and the selected model (both are load-time params in wllama)
    // so the worker allocates enough context and loads the right GGUF.
    const settings = getSettings();
    w.postMessage({
      type: 'init',
      params: {
        n_ctx: settings.n_ctx,
        model: resolveModel(settings.model),
      },
    });
  });
}

export async function generate(
  messages: ChatMessage[],
  params: GenerationParams,
  onToken: (text: string) => void
): Promise<void> {
  const w = getWorker();
  const id = crypto.randomUUID();
  currentGenerateId = id;

  return new Promise<void>((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as WorkerMessage;

      if (msg.id !== id) return;

      switch (msg.type) {
        case 'token':
          onToken(msg.text ?? '');
          break;

        case 'done':
          w.removeEventListener('message', handler);
          currentGenerateId = null;
          resolve();
          break;

        case 'error':
          w.removeEventListener('message', handler);
          currentGenerateId = null;
          reject(new Error(msg.message ?? 'Generation error'));
          break;
      }
    };

    w.addEventListener('message', handler);
    w.postMessage({ type: 'generate', id, messages, params });
  });
}

export function abort(): void {
  if (worker && currentGenerateId) {
    worker.postMessage({ type: 'abort', id: currentGenerateId });
    currentGenerateId = null;
  }
}

export interface CacheClearResult {
  count: number;
  freedBytes: number;
}

/**
 * Erase all downloaded model files from the browser's persistent storage
 * (wllama caches GGUFs in OPFS / COS). The in-memory model keeps working for
 * this session; the next reload re-downloads the model.
 */
export function clearModelCache(): Promise<CacheClearResult> {
  const w = getWorker();
  const id = crypto.randomUUID();

  return new Promise<CacheClearResult>((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as WorkerMessage;
      if (msg.id !== id) return;
      w.removeEventListener('message', handler);
      if (msg.type === 'cache-cleared') {
        resolve({ count: msg.count ?? 0, freedBytes: msg.freedBytes ?? 0 });
      } else if (msg.type === 'error') {
        reject(new Error(msg.message ?? 'Échec de la suppression du cache'));
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ type: 'clear-cache', id });
  });
}

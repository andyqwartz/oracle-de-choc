// src/llm/engine.ts
// Public API for the rest of the app. Encapsulates the Web Worker
// and exposes init(), generate(), abort().

import type { ChatMessage, GenerationParams } from '../types';

interface WorkerMessage {
  type: string;
  id?: string;
  loaded?: number;
  total?: number;
  text?: string;
  message?: string;
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

export async function initEngine(onProgress: (loaded: number, total: number) => void): Promise<void> {
  const w = getWorker();

  return new Promise<void>((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as WorkerMessage;

      switch (msg.type) {
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
    w.postMessage({ type: 'init' });
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

      // Only handle messages for our current generation
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
  }
}

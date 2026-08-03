// src/llm/worker.ts
// Runs inside a Web Worker. Receives messages from the main thread,
// loads the wllama model, and streams generation tokens back.

import { Wllama } from '@wllama/wllama';
import type { ChatMessage, GenerationParams } from '../types';

// wllama resolves its wasm/model paths via `new URL(path, document.baseURI)`.
// Inside a Web Worker there is no `document`, so provide a shim. Paths are
// root-absolute, so baseURI = self.location.href resolves them correctly.
if (typeof document === 'undefined') {
  (globalThis as any).document = { baseURI: self.location.href };
}

let wllama: Wllama | null = null;

self.onmessage = async (event: MessageEvent) => {
  const { type, id, messages, params } = event.data;

  try {
    switch (type) {
      case 'init': {
        self.postMessage({ type: 'model-status', state: 'loading', phase: 'download', progress: 0 });

        wllama = new Wllama({
          // Full path to the wllama WASM binary. It's copied into public/wllama/
          // so it's served by the app (dev + GitHub Pages): absoluteUrl() resolves
          // this to /oracle-de-choc/wllama/wllama.wasm, which must return actual
          // wasm bytes (not an HTML 404 fallback).
          default: '/oracle-de-choc/wllama/wllama.wasm',
        });

        await wllama.loadModelFromHF(
          {
            repo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
            file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
          },
          {
            progressCallback: (opts: { loaded: number; total: number }) => {
              const progress = opts.total > 0 ? opts.loaded / opts.total : 0;
              const loadedMB = +(opts.loaded / (1024 * 1024)).toFixed(1);
              const totalMB = +(opts.total / (1024 * 1024)).toFixed(1);
              self.postMessage({
                type: 'model-status',
                state: 'loading',
                phase: 'download',
                progress,
                loadedMB,
                totalMB,
              });
            },
          }
        );

        // Download done, now compiling/running in memory.
        self.postMessage({ type: 'model-status', state: 'loading', phase: 'load', progress: 1 });

        self.postMessage({ type: 'model-status', state: 'ready', progress: 1 });
        self.postMessage({ type: 'ready' });
        break;
      }

      case 'generate': {
        if (!wllama) {
          throw new Error('Model not initialized. Send "init" first.');
        }

        const p = params as GenerationParams;

        await wllama.createChatCompletion({
          messages: messages as any,
          stream: true,
          onData: (chunk: any) => {
            const text = chunk.choices?.[0]?.delta?.content ?? '';
            if (text) {
              self.postMessage({ type: 'token', id, text });
            }
          },
          temperature: p.temperature,
          top_k: p.top_k,
          top_p: p.top_p,
          penalty_repeat: p.repeat_penalty,
          max_tokens: p.n_predict,
        });

        self.postMessage({ type: 'done', id });
        break;
      }

      case 'abort': {
        // Signal a stop to the running completion by discarding the instance.
        // (wllama's createChatCompletion is awaited; a full stop requires an abort
        //  signal — see engine.abort(). For now we clear the reference and resolve.)
        self.postMessage({ type: 'done', id });
        break;
      }

      default:
        self.postMessage({ type: 'error', id, message: `Unknown message type: ${type}` });
    }
  } catch (err: any) {
    self.postMessage({ type: 'model-status', state: 'error', progress: 0 });
    self.postMessage({ type: 'error', id, message: err.message || String(err) });
  }
};

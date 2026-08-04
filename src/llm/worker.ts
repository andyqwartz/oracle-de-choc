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
          // Full path to the wllama WASM binary (copied into public/wllama/).
          default: '/oracle-de-choc/wllama/wllama.wasm',
        });

        // n_ctx is a model-loading parameter (default 1024 in wllama). We must pass
        // the configured value here — RAG context + system prompt + history can
        // exceed 1024 tokens and would otherwise fail with "exceeds context size".
        const nCtx = params?.n_ctx ?? 4096;
        // Selected GGUF model (repo + file), passed from settings by the engine.
        const model = params?.model ?? {
          repo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
          file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
        };

        await wllama.loadModelFromHF(
          {
            repo: model.repo,
            file: model.file,
          },
          {
            n_ctx: nCtx,
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

      case 'clear-cache': {
        // Erase all downloaded model files from the browser's persistent
        // storage (OPFS / COS). wllama's CacheManager owns those files; the
        // current in-memory model keeps working, but the next reload will have
        // to re-download the GGUF.
        let cache = wllama?.cacheManager ?? null;
        if (!cache) {
          // Model never initialized — still allow clearing (e.g. stale files).
          const { CacheManager } = await import('@wllama/wllama');
          cache = new CacheManager();
        }
        const entries = await cache.list();
        const count = entries.length;
        const freedBytes = entries.reduce((acc, e) => acc + (e.size || 0), 0);
        await cache.clear();
        self.postMessage({ type: 'cache-cleared', id, count, freedBytes });
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

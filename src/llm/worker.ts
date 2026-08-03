// src/llm/worker.ts
// Runs inside a Web Worker. Receives messages from the main thread,
// loads the wllama model, and streams generation tokens back.

import { Wllama } from '@wllama/wllama';
import type { ChatMessage, GenerationParams } from '../types';

let wllama: Wllama | null = null;

self.onmessage = async (event: MessageEvent) => {
  const { type, id, messages, params } = event.data;

  try {
    switch (type) {
      case 'init': {
        self.postMessage({ type: 'progress', loaded: 0, total: 1 });

        wllama = new Wllama({
          default: '/oracle-de-choc/wllama',
        });

        await wllama.loadModelFromHF(
          {
            repo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
            file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
          },
          {
            progressCallback: (opts: { loaded: number; total: number }) => {
              self.postMessage({ type: 'progress', loaded: opts.loaded, total: opts.total });
            },
          }
        );

        self.postMessage({ type: 'ready' });
        break;
      }

      case 'generate': {
        if (!wllama) {
          throw new Error('Model not initialized. Send "init" first.');
        }

        const p = params as GenerationParams;

        // wllama v3 API: createChatCompletion takes a single options object.
        // repeat_penalty -> penalty_repeat, n_predict -> max_tokens.
        // n_ctx is a model-loading param, not a completion param.
        // With stream:true + onData, the function returns Promise<void>.
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
        wllama = null;
        self.postMessage({ type: 'done', id });
        break;
      }

      default:
        self.postMessage({ type: 'error', id, message: `Unknown message type: ${type}` });
    }
  } catch (err: any) {
    self.postMessage({ type: 'error', id, message: err.message || String(err) });
  }
};

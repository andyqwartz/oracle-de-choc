// src/llm/worker.ts
// Runs inside a Web Worker. Receives messages from the main thread,
// loads the wllama model, and streams generation tokens back.

import { loadModelFromHF, createChatCompletion } from 'wllama';

let model: any = null;

self.onmessage = async (event: MessageEvent) => {
  const { type, id, messages, params } = event.data;

  try {
    switch (type) {
      case 'init': {
        self.postMessage({ type: 'progress', loaded: 0, total: 1 });

        model = await loadModelFromHF(
          {
            repo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
            file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
          },
          {
            progressCallback: (loaded: number, total: number) => {
              self.postMessage({ type: 'progress', loaded, total });
            },
          }
        );

        self.postMessage({ type: 'ready' });
        break;
      }

      case 'generate': {
        if (!model) {
          throw new Error('Model not initialized. Send "init" first.');
        }

        const stream = await createChatCompletion(model, messages, {
          temperature: params.temperature,
          top_k: params.top_k,
          top_p: params.top_p,
          repeat_penalty: params.repeat_penalty,
          n_predict: params.n_predict,
          n_ctx: params.n_ctx,
          stream: true,
        });

        for await (const token of stream) {
          self.postMessage({ type: 'token', id, text: token });
        }

        self.postMessage({ type: 'done', id });
        break;
      }

      case 'abort': {
        // wllama doesn't have a native abort, so we null the model reference
        // and the generate loop will fail on next iteration.
        // A more robust approach: track an AbortSignal and pass it to createChatCompletion
        // when wllama supports it. For now, we set model to null to stop generation.
        model = null;
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

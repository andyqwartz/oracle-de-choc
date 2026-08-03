// main.ts — entry point. Assembles the app: loads model + index in parallel,
// then wires up the UI once both are ready.

import './ui/styles/tokens.css';
import './ui/styles/app.css';
import { initEngine, generate, abort } from './llm/engine';
import { loadIndex, type CompactIndex } from './rag/loadIndex';
import { loadEpisodes } from './rag/episodes';
import { retrieve, buildContextBlock } from './rag/retrieve';
import { AppShell } from './ui/layout/AppShell';
import { getSettings } from './settings/store';
import type { ChatMessage, RagChunk } from './types';

async function main() {
  const app = new AppShell();
  app.render(document.getElementById('app')!);

  let idx: CompactIndex | null = null;

  // Conversation history (excluding system prompt, added per request).
  let history: { role: 'user' | 'assistant'; content: string }[] = [];

  app.setStatus('Initialisation…', 'loading');

  // ---- Model + index loading (parallel) ----
  const engineReady = initEngine(
    (status) => app.setModelStatus(status),
    (loaded, total) => app.setProgress(loaded, total)
  );

  const indexReady = loadIndex().then((d) => {
    idx = d;
    return d;
  });

  // Episode list (independent, small)
  loadEpisodes().then((eps) => app.setEpisodes(eps));

  let generationInFlight = false;

  async function sendMessage(text: string) {
    if (generationInFlight || !idx) return;

    const settings = getSettings();
    generationInFlight = true;
    app.setGenerating(true);

    history.push({ role: 'user', content: text });
    app.appendMessage('user', text);

    app.setStatus('Génération…', 'loading');

    let fullResponse = '';
    let sources: RagChunk[] = [];

    try {
      // ---- RAG retrieval ----
      let context = '';
      if (settings.ragEnabled && idx) {
        // Scoping to a single episode is handled by retrieve().
        sources = await retrieve(idx, text, settings.ragTopK, app.selectedEpisode);

        if (sources.length > 0) {
          // Cap the RAG context to a token budget so the total prompt (system +
          // context + history) stays within n_ctx after reserving room for output.
          // Rough estimate: ~4 chars per token for French.
          const CONTEXT_BUDGET_TOKENS = 1600;
          const MAX_CHARS = CONTEXT_BUDGET_TOKENS * 4;
          let used = 0;
          let kept: typeof sources = [];
          for (const s of sources) {
            const cost = s.content.length;
            if (kept.length > 0 && used + cost > MAX_CHARS) break;
            kept.push(s);
            used += cost;
          }
          sources = kept;
          context = buildContextBlock(sources);
        } else {
          context = 'Aucun extrait pertinent trouvé.';
        }
      }

      // ---- Build messages (system prompt with context) ----
      const basePrompt = settings.systemPrompt.replace(
        '{context}',
        context || 'Aucun extrait pertinent trouvé.'
      );
      // Trim a trailing placeholder line if no context was injected.
      const systemPrompt = basePrompt.trim();

      // Keep the conversation context-bounded: the RAG context + system prompt
      // already consume most of n_ctx, so only pass the most recent turns.
      const MAX_HISTORY_TURNS = 6; // 6 user/assistant pairs = 12 messages
      const window = history.slice(-MAX_HISTORY_TURNS);

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...window.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
      ];

      // ---- Stream generation (assistant bubble + token stream) ----
      app.appendMessage('assistant', '');
      await generate(
        messages,
        {
          temperature: settings.temperature,
          top_k: settings.top_k,
          top_p: settings.top_p,
          repeat_penalty: settings.repeat_penalty,
          n_predict: settings.n_predict,
          n_ctx: settings.n_ctx,
        },
        (token) => {
          fullResponse += token;
          app.streamToken(fullResponse);
        }
      );
      app.streamToken(fullResponse, true);

      // Attach source chips to the completed assistant bubble.
      if (sources.length > 0) app.attachSources(sources);

      // Push the REAL response into history (so the next turn has context).
      history.push({ role: 'assistant', content: fullResponse });

      app.setStatus('Prêt.', 'ok');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      app.setStatus('Erreur : ' + msg, 'error');
    } finally {
      generationInFlight = false;
      app.setGenerating(false);
    }
  }

  app.onSend(sendMessage);
  app.onStop(() => {
    if (generationInFlight) abort();
  });
  app.onSidebarSelect((ep) => {
    app.selectedEpisode = ep;
    app.setStatus(ep ? `Question limitée à : ${ep}` : 'Recherche sur tout le catalogue.', 'default');
  });
  app.onReloadModel(() => {
    location.reload();
  });

  try {
    await Promise.all([engineReady, indexReady]);
    app.setModelStatus({ state: 'ready', progress: 1 });
    app.setStatus('Prêt — pose ta question.', 'ok');
    app.setProgress(0, 0);
    app.enableComposer();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    app.setModelStatus({ state: 'error', progress: 0 });
    app.setStatus('Erreur de chargement : ' + msg, 'error');
    console.error('Init failed:', err);
  }
}

main();

// main.ts — entry point. Assembles the app: loads model + index in parallel,
// then wires up the UI once both are ready.

import './ui/styles/tokens.css';
import './ui/styles/app.css';
import { CONFIG } from './config';
import { initEngine, generate, abort } from './llm/engine';
import { loadIndex } from './rag/loadIndex';
import { loadEpisodes } from './rag/episodes';
import { retrieve, buildContextBlock } from './rag/retrieve';
import { AppShell } from './ui/layout/AppShell';
import { getSettings } from './settings/store';
import type { ChatMessage } from './types';

async function main() {
  const app = new AppShell();
  app.render(document.getElementById('app')!);

  let db: any = null;

  // Conversation history (excluding system prompt, added per request)
  let history: { role: 'user' | 'assistant'; content: string }[] = [];

  app.setStatus('Initialisation…', 'loading');

  // ---- Model + index loading (parallel) ----
  const engineReady = initEngine(
    (status) => app.setModelStatus(status),      // top bar + settings model panel
    (loaded, total) => app.setProgress(loaded, total)
  );

  const indexReady = loadIndex().then((d) => {
    db = d;
    return d;
  });

  // Episode list (independent, small)
  loadEpisodes().then((eps) => app.setEpisodes(eps));

  let generationInFlight = false;

  async function sendMessage(text: string) {
    if (generationInFlight || !db) return;

    const settings = getSettings();
    generationInFlight = true;
    app.setGenerating(true);

    history.push({ role: 'user', content: text });
    app.appendMessage('user', text);

    app.setStatus('Génération…', 'loading');

    try {
      // ---- RAG retrieval ----
      let sources: { content: string; episode: string; score?: number }[] = [];
      let context = '';
      if (settings.ragEnabled && db) {
        const scopeEp = app.selectedEpisode;
        sources = await retrieve(db, text, settings.ragTopK, scopeEp);
        context = buildContextBlock(sources);
      }

      // ---- Build messages (system prompt with context) ----
      const systemPrompt = settings.systemPrompt.replace('{context}', context || 'Aucun extrait pertinent trouvé.');
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
      ];

      // ---- Stream generation ----
      app.appendMessage('assistant', '', sources);
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
        (token) => app.streamToken(token)
      );
      app.streamToken('', true);

      history.push({ role: 'assistant', content: '' }); // placeholder; final text accumulated
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

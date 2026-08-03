// main.ts — entry point. Assembles the app: loads model + index in parallel,
// then wires up the UI once both are ready.

import { CONFIG } from './config';
import { initEngine, onProgress } from './llm/engine';
import { loadIndex } from './rag/loadIndex';
import { AppShell } from './ui/layout/AppShell';
import { defaultSettings, getSettings } from './settings/store';

async function main() {
  const app = new AppShell();
  app.render(document.getElementById('app')!);

  // Show loading state
  app.setStatus('Chargement du modèle et de l\'index…');

  // Load model and index in parallel
  const settings = getSettings();

  const engineReady = initEngine((loaded, total) => {
    app.setProgress(loaded, total);
  });

  const indexReady = loadIndex();

  try {
    await Promise.all([engineReady, indexReady]);
    app.setStatus('Prêt — pose ta question.');
    app.setProgress(0, 0);
    app.enableComposer();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    app.setStatus('Erreur de chargement : ' + msg);
    console.error('Init failed:', err);
  }
}

main();

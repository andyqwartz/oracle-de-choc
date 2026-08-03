# Oracle de Choc

Un assistant conversationnel basé sur les archives du podcast **Méta de Choc**.
Interroge les transcriptions d'épisodes avec un modèle LLM local (wllama)
et un système de retrieval-augmented generation (RAG).

## Architecture

- **LLM** : `wllama` + `Qwen/Qwen2.5-0.5B-Instruct-GGUF` (Q4_K_M, 0.5B params)
- **Embeddings** : `Xenova/all-MiniLM-L6-v2` (384 dim) via `@huggingface/transformers`
- **Base vectorielle** : `@orama/orama` avec persistance JSON
- **Bundler** : Vite + TypeScript, sans framework UI
- **UI** : DOM natif, trois zones fixes (Sidebar, ChatPanel, SettingsDrawer)

## Démarrage rapide

```bash
# Installer les dépendances
npm install

# (Optionnel) Construire l'index vectoriel à partir des transcriptions
npm run build-index

# Lancer le dev server
npm run dev
```

## Structure du projet

```
src/
├── main.ts              # Point d'entrée
├── config.ts            # Constantes (modèles, chemins)
├── types.ts             # Types partagés
├── llm/
│   ├── worker.ts        # Web Worker pour le modèle
│   └── engine.ts        # API publique pour l'UI
├── rag/
│   ├── loadIndex.ts     # Charge l'index pré-construit
│   ├── embedQuery.ts    # Embed une question dans le navigateur
│   └── retrieve.ts      # Recherche vectorielle + bloc de contexte
├── settings/
│   ├── schema.ts        # Schéma des paramètres
│   └── store.ts         # Persistance localStorage
└── ui/
    ├── layout/
    │   ├── AppShell.ts  # Assemble toute l'interface
    │   └── Sidebar.ts   # Liste des épisodes
    ├── chat/
    │   ├── ChatPanel.ts
    │   ├── MessageList.ts
    │   └── Composer.ts
    └── styles/
        ├── tokens.css   # Variables CSS
        └── app.css      # Styles globaux
```

## Déploiement

Déployé via GitHub Pages. Le workflow `.github/workflows/deploy.yml` build
automatiquement à chaque push sur `main`.

## Configuration

Les paramètres (température, top_k, top_p, etc.) sont persistés dans
`localStorage` sous la clé `oracle-de-choc:settings`.

## Licence

MIT

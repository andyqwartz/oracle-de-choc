# Oracle de Choc

Un assistant conversationnel basé sur les archives du podcast **Méta de Choc**.
Interroge les transcriptions d'épisodes avec un LLM local (wllama / WASM) et un
système de **retrieval-augmented generation (RAG)** alimenté par un index
vectoriel compact hébergé sur Hugging Face.

## Architecture

- **LLM** : `wllama` (inference WASM dans le navigateur) + un modèle **GGUF
  Qwen2.5-Instruct** sélectionnable dans les paramètres :
  - `Qwen2.5-0.5B-Instruct-GGUF` (Q4_K_M, par défaut)
  - `Qwen2.5-1.5B-Instruct-GGUF` (Q4_K_M)
  - `Qwen2.5-3B-Instruct-GGUF` (Q4_K_M)
- **Embeddings** : `Xenova/all-MiniLM-L6-v2` (384 dims) via `@huggingface/transformers`,
  pool mean + normalize (identique côté build et côté requête)
- **Index vectoriel compact** : `chunks.json` + `embeddings.bin` (Float32 bruts) +
  `oracle-index.meta.json` — remplace l'ancien dump JSON `@orama/orama` (~200 MB,
  freeze au chargement). Recherche par **cosinus brut** (brute-force), dimension 384,
  ~6 000 chunks → quelques ms.
- **Bundler** : Vite + TypeScript, sans framework UI
- **UI** : DOM natif, trois zones fixes (Sidebar, ChatPanel, SettingsDrawer)

## Démarrage rapide

```bash
# Installer les dépendances
npm install

# (Optionnel) Construire l'index vectoriel à partir des transcriptions locales.
# En dev, l'index local doit exister sous public/index/.
npm run build-index

# Lancer le dev server
npm run dev
```

Le dev server tourne sous le base path `/oracle-de-choc/` :
http://localhost:5173/oracle-de-choc/

## RAG — Index et source HF

L'index vectoriel est construit via `npm run build-index` (lit
`data/transcripts/<episode>/formats/transcript_formatted.txt`, chunk par phrases
budgétées en tokens, embed, écrit `public/index/`).

Il est ensuite publié sur Hugging Face, sous le repo dataset **v2** :

```
AndyVampiro/oracle-de-choc-index-v2
```

Contenu (fichiers à la racine du repo dataset) :

- `chunks.json` — `[{ content, episode }]`, 6 095 chunks / 242 épisodes
- `embeddings.bin` — Float32 bruts (dim × nb chunks), ~9 MB
- `oracle-index.meta.json` — métadonnées (embeddingModel, dim, chunkCount…)
- `episodes.json` — liste des épisodes (petit, embarqué dans l'app aussi)

**Résolution des URLs** (`src/config.ts`) :
- **Dev** (`import.meta.env.DEV`) → fichiers locaux `public/index/*`
- **Prod (GitHub Pages)** → fetch direct depuis le repo HF `resolve/main`

Le chargement vérifie que `meta.embeddingModel` correspond à celui configuré et
que la taille des embeddings est cohérente (`dim × nbChunks`) — sinon il refuse
de charger et demande un `npm run build-index` (évite un index corrompu).

**Parcours RAG** (`src/main.ts` + `src/rag/`) :
1. On embed la question du user (`embedQuery`)
2. `retrieve()` calcule la similarité cosinus sur tout l'index, garde le top-K
   (réglable `ragTopK`, et scopable à un épisode via la Sidebar)
3. `buildContextBlock()` assemble les extraits
4. Injectés dans le prompt système via le placeholder `{context}`
5. Le budget contexte est borné (~1600 tokens) pour rester sous `n_ctx`

## Structure du projet

```
src/
├── main.ts              # Point d'entrée (charge modèle + index, câble le RAG)
├── config.ts            # Constantes : MODELS (liste GGUF), chemins index
├── types.ts             # Types partagés
├── llm/
│   ├── worker.ts        # Web Worker (wllama, charge le modèle choisi)
│   └── engine.ts        # API publique pour l'UI
├── rag/
│   ├── loadIndex.ts     # Charge l'index compact (meta + chunks + embeddings)
│   ├── embedQuery.ts    # Embed une question dans le navigateur
│   ├── retrieve.ts      # Cosinus + bloc de contexte
│   └── episodes.ts      # Liste des épisodes
├── settings/
│   ├── schema.ts        # Schéma des paramètres (modèle, température, RAG…)
│   └── store.ts         # Persistance localStorage
└── ui/
    ├── layout/
    │   ├── AppShell.ts  # Assemble l'interface
    │   ├── TopBar.ts    # Statut modèle + toggles
    │   └── Sidebar.ts   # Liste des épisodes
    ├── chat/
    │   ├── ChatPanel.ts
    │   ├── MessageList.ts
    │   └── Composer.ts
    ├── SettingsDrawer.ts # Panneau paramètres (généré depuis le schéma)
    └── styles/
        ├── tokens.css   # Variables CSS
        └── app.css      # Styles globaux
```

## Configuration

Les paramètres sont persistés dans `localStorage` sous la clé
`oracle-de-choc:settings` et générés depuis `src/settings/schema.ts` :

- **Modèle** — sélection du GGUF (changer de modèle déclenche un rechargement
  et un re-téléchargement du nouveau fichier)
- **Génération** — `temperature`, `top_k`, `top_p`, `repeat_penalty`,
  `n_predict` (max tokens), `n_ctx` (contexte alloué au chargement)
- **Recherche** — `ragEnabled`, `ragTopK`
- **Système** — `systemPrompt` (contient le placeholder `{context}`)

> **Contexte (n_ctx)** : paramètre passé au chargement du modèle dans wllama.
> La valeur par défaut de wllama (1024) est trop petite pour RAG + prompt +
> historique ; la valeur configurée est transmise au worker à `init`.

## Modèles de remplacement

Pour ajouter un modèle, compléter le tableau `MODELS` dans `src/config.ts`
(`id`, `repo` HF du GGUF, `file`, `label`, `params`) — il apparaîtra
automatiquement dans le menu déroulant des paramètres. Le modèle doit être un
GGUF chargeable par wllama depuis sa repo HF.

## Audit / diagnostic RAG

`node scripts/audit-rag.mjs` vérifie en ligne de commande l'intégrité de l'index
(taille des embeddings vs nombre de chunks) et la pertinence de la recherche
pour quelques requêtes de test. Utile pour valider un index re-généré avant de
le publier sur HF.

## Déploiement

Déployé via GitHub Pages. Le workflow `.github/workflows/deploy.yml` build
automatiquement à chaque push sur `main`. En production l'index est chargé
depuis `AndyVampiro/oracle-de-choc-index-v2` (pas depuis le repo git).

## Licence

MIT

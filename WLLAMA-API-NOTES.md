# Wllama API Mapping Notes

## Version installée: @wllama/wllama ^3.5.1

### Changements clés par rapport à l'ancienne API

#### 1. Constructeur Wllama
- Ancien: `new Wllama({ wasmPath: '/oracle-de-choc/wllama' })`
- Nouveau: `new Wllama({ default: '/oracle-de-choc/wllama' })`
- Le paramètre `wasmPath` n'existe plus. AssetsPathConfig utilise `default` + options `single-thread/wllama.wasm` et `multi-thread/wllama.wasm`.

#### 2. loadModelFromHF
- Signature inchangée: `wllama.loadModelFromHF({ repo, file }, { progressCallback })`
- Mais `progressCallback` changed:
  - Ancien: `(loaded: number, total: number) => void`
  - Nouveau: `(opts: { loaded: number; total: number }) => void`
  - Prend un objet, pas deux arguments séparés.

#### 3. createChatCompletion
- Ancien: `wllama.createChatCompletion(messages, { temperature, top_k, top_p, repeat_penalty, n_predict, n_ctx, stream: true })`
- Nouveau: `wllama.createChatCompletion({ messages, stream: true, onData: (chunk) => {...}, temperature, top_k, top_p, penalty_repeat, max_tokens })`
- Changements:
  - `repeat_penalty` → `penalty_repeat`
  - `n_predict` → `max_tokens`
  - `n_ctx` n'est PAS un paramètre de chat completion (c'est un paramètre de chargement du modèle)
  - `onData` remplace l'itération `for await...of` sur le stream
  - Le stream retourne `AsyncIterable<ChatCompletionChunk>` quand `stream: true` et `onData` est fourni, mais la fonction retourne `Promise<void>` (pas de stream à consommer)
  - Les tokens sont délivrés via le callback `onData`, pas via l'itérateur

#### 4. ChatCompletionChunk structure
- `chunk.choices[0].delta.content` contient le texte du token

#### 5. Orama types (version actuelle)
- `Orama` est maintenant un type générique: `Orama<TSchema, TIndex, TDocumentStore, TSorter, TPinning>`
- `AnyOrama` existe toujours mais `restore()` retourne un type concret
- Pour `loadIndex.ts`: utiliser `Orama` avec les bons type params ou utiliser le type retourné par `restore()`

#### 6. Embeddings
- `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { pooling: 'mean', normalize: true })`
- Le résultat est un tensor/array, pas toujours un simple `number[]`
- Il faut souvent faire `Array.isArray(result) ? result : Array.from(result as unknown as number[])`

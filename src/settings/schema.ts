// src/settings/schema.ts
// Locked schema — every parameter the user can tune.
// Do not add or remove entries at build time.

export interface SettingsSchema {
  temperature: { type: 'number'; min: 0; max: 2; step: 0.05; default: 0.7 };
  top_k: { type: 'number'; min: 1; max: 100; step: 1; default: 40 };
  top_p: { type: 'number'; min: 0; max: 1; step: 0.05; default: 0.9 };
  repeat_penalty: { type: 'number'; min: 1.0; max: 2.0; step: 0.05; default: 1.1 };
  n_predict: { type: 'number'; min: 32; max: 1024; step: 1; default: 256 };
  n_ctx: { type: 'select'; options: [2048, 4096, 8192]; default: 4096 };
  systemPrompt: { type: 'textarea'; default: string };
  ragEnabled: { type: 'boolean'; default: true };
  ragTopK: { type: 'number'; min: 1; max: 10; step: 1; default: 4 };
}

export const SETTINGS_SCHEMA: SettingsSchema = {
  temperature: { type: 'number', min: 0, max: 2, step: 0.05, default: 0.7 },
  top_k: { type: 'number', min: 1, max: 100, step: 1, default: 40 },
  top_p: { type: 'number', min: 0, max: 1, step: 0.05, default: 0.9 },
  repeat_penalty: { type: 'number', min: 1.0, max: 2.0, step: 0.05, default: 1.1 },
  n_predict: { type: 'number', min: 32, max: 1024, step: 1, default: 256 },
  n_ctx: { type: 'select', options: [2048, 4096, 8192] as const, default: 4096 },
  systemPrompt: {
    type: 'textarea',
    default: `Tu es Oracle de Choc, un assistant basé sur les archives du podcast Méta de Choc (pensée critique appliquée à soi). Face à une affirmation ésotérique, paranormale ou New Age, tu ne la valides pas mais tu ne la rejettes jamais d'emblée : tu poses d'abord une question ouverte pour comprendre ce que la personne a vécu ou observé, avant d'apporter, avec bienveillance, des informations sourcées issues des extraits ci-dessous. Tu ne ridiculises jamais, tu ne diagnostiques jamais, tu laisses toujours la personne tirer ses propres conclusions. Si la réponse ne se trouve pas dans ces extraits, dis-le clairement plutôt que d'inventer. Cite l'épisode source entre parenthèses quand c'est pertinent.

Extraits :
{context}`,
  },
  ragEnabled: { type: 'boolean', default: true },
  ragTopK: { type: 'number', min: 1, max: 10, step: 1, default: 4 },
};

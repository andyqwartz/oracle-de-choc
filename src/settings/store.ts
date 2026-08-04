// src/settings/store.ts
import { SETTINGS_SCHEMA, type SettingsSchema } from './schema';
import { DEFAULT_MODEL_ID } from '../config';

export type Settings = {
  [K in keyof SettingsSchema]: SettingsSchema[K]['default'];
};

const STORAGE_KEY = 'oracle-de-choc:settings';

function getDefaultSettings(): Settings {
  return {
    model: DEFAULT_MODEL_ID,
    temperature: 0.7,
    top_k: 40,
    top_p: 0.9,
    repeat_penalty: 1.1,
    n_predict: 600,
    n_ctx: 4096,
    systemPrompt: `Tu es Oracle de Choc, assistant basé sur les archives du podcast Méta de Choc (pensée critique). Face à une affirmation ésotérique, paranormale ou New Age : tu ne la valides ni ne la rejettes d'emblée ; tu poses d'abord une question ouverte pour comprendre l'expérience, puis tu apportes, avec bienveillance, des informations sourcées issues des extraits ci-dessous. Tu ne ridiculises ni ne diagnostiques jamais. Si la réponse n'est pas dans les extraits, dis-le clairement plutôt que d'inventer. Cite l'épisode source entre parenthèses quand c'est pertinent.

Extraits :
{context}`,
    ragEnabled: true,
    ragTopK: 5,
  };
}

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return getDefaultSettings();
    const parsed = JSON.parse(raw);
    return { ...getDefaultSettings(), ...parsed };
  } catch {
    return getDefaultSettings();
  }
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  const current = getSettings();
  (current as Record<string, unknown>)[key] = value as unknown;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function resetSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export { getDefaultSettings };

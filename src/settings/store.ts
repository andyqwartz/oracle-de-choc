// src/settings/store.ts
// Persists settings to localStorage under the key 'oracle-de-choc:settings'.

import { SETTINGS_SCHEMA, type SettingsSchema } from './schema';

export type Settings = {
  [K in keyof SettingsSchema]: SettingsSchema[K]['default'];
};

const STORAGE_KEY = 'oracle-de-choc:settings';

function getDefaultSettings(): Settings {
  const defaults = {} as Settings;
  for (const [key, def] of Object.entries(SETTINGS_SCHEMA)) {
    defaults[key as keyof Settings] = def.default as any;
  }
  return defaults;
}

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return getDefaultSettings();
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle new keys if schema evolves
    return { ...getDefaultSettings(), ...parsed };
  } catch {
    return getDefaultSettings();
  }
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  const current = getSettings();
  current[key] = value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function resetSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export { getDefaultSettings };

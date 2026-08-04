// src/ui/SettingsDrawer.ts
// Right panel: model status + settings generated from the schema, grouped by section.

import { SETTINGS_SCHEMA, type SettingsSchema } from '../settings/schema';
import { getSettings, setSetting, resetSettings } from '../settings/store';
import { MODELS, getModelDef } from '../config';
import type { ModelStatus } from '../types';

export class SettingsDrawer {
  private container: HTMLElement;
  private modelPanel!: HTMLElement;
  private onReloadModel: (() => void) | null = null;
  private onRequestCloseCb: (() => void) | null = null;

  constructor() {
    this.container = document.createElement('aside');
    this.container.className = 'settings-drawer';
    this.container.setAttribute('role', 'complementary');
    this.container.setAttribute('aria-label', 'Paramètres');
  }

  render(): HTMLElement {
    this.container.innerHTML = `
      <div class="settings-header">
        <h2>Paramètres</h2>
        <button class="icon-btn" id="settings-close" aria-label="Fermer les paramètres"><span class="icon">✕</span></button>
      </div>

      <section aria-label="Modèle">
        <div class="settings-section-title">Modèle</div>
        <div class="model-panel" id="model-panel"></div>
      </section>

      <section aria-label="Génération">
        <div class="settings-section-title">Génération</div>
        <div class="setting-group" id="group-generation"></div>
      </section>

      <section aria-label="Recherche">
        <div class="settings-section-title">Recherche</div>
        <div class="setting-group" id="group-rag"></div>
      </section>

      <section aria-label="Système">
        <div class="settings-section-title">Système</div>
        <div class="setting-group" id="group-system"></div>
      </section>
    `;

    this.modelPanel = this.container.querySelector('#model-panel')!;
    this.renderModelPanel({ state: 'idle' as const, progress: 0 });
    this.renderSettings();

    this.container.querySelector('#settings-close')!.addEventListener('click', () => {
      this.onRequestCloseCb?.();
    });

    return this.container;
  }

  onRequestClose(cb: () => void) {
    this.onRequestCloseCb = cb;
  }

  setModelStatus(status: ModelStatus) {
    this.renderModelPanel(status);
  }

  onReloadModelRequested(cb: () => void) {
    this.onReloadModel = cb;
  }

  private renderModelPanel(status: ModelStatus) {
    const pct = Math.round(status.progress * 100);

    let progressHtml = '';
    if (status.state === 'loading') {
      const label =
        status.phase === 'download'
          ? `Téléchargement${status.totalMB ? ` · ${status.loadedMB}/${status.totalMB} Mo` : ''}`
          : 'Chargement en mémoire…';
      progressHtml = `
        <div class="model-progress">
          <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
          <div class="model-progress-label">${label} · ${pct}%</div>
        </div>`;
    }

    this.modelPanel.innerHTML = `
      <div class="model-row"><span class="k">Modèle</span><span class="v">${getModelDef(getSettings().model).label} · Q4_K_M</span></div>
      <div class="model-row"><span class="k">Statut</span><span class="v">${this.fmtState(status.state)}</span></div>
      <div class="model-row"><span class="k">Index</span><span class="v">242 épisodes</span></div>
      ${progressHtml}
      <div class="btn-row">
        <button class="btn" id="reload-model" ${status.state === 'loading' ? 'disabled' : ''}>Recharger le modèle</button>
      </div>
    `;

    this.modelPanel.querySelector('#reload-model')?.addEventListener('click', () => {
      this.onReloadModel?.();
    });
  }

  private fmtState(s: ModelStatus['state']): string {
    const map: Record<ModelStatus['state'], string> = {
      idle: 'En attente',
      loading: 'Chargement…',
      ready: 'Prêt',
      error: 'Erreur',
    };
    return map[s];
  }

  private renderSettings() {
    const groups: Record<string, string[]> = {
      generation: [],
      rag: [],
      system: [],
    };

    const genKeys = ['model', 'temperature', 'top_k', 'top_p', 'repeat_penalty', 'n_predict', 'n_ctx'];
    const ragKeys = ['ragEnabled', 'ragTopK'];
    const sysKeys = ['systemPrompt'];

    for (const k of genKeys) groups.generation.push(k);
    for (const k of ragKeys) groups.rag.push(k);
    for (const k of sysKeys) groups.system.push(k);

    for (const [groupName, keys] of Object.entries(groups)) {
      const target = this.container.querySelector(`#group-${groupName}`)!;
      for (const key of keys) {
        const spec = (this.schema as any)[key];
        const row = document.createElement('div');
        row.className = 'setting-row';

        const label = document.createElement('label');
        label.textContent = this.fmtKey(key);
        label.setAttribute('for', `setting-${key}`);
        row.appendChild(label);

        const currentValue = getSettings()[key as keyof typeof SETTINGS_SCHEMA];
        this.renderControl(row, key, spec, currentValue);
        target.appendChild(row);
      }
    }
  }

  private fmtKey(key: string): string {
    const map: Record<string, string> = {
      model: 'Modèle',
      temperature: 'Température',
      top_k: 'Top K',
      top_p: 'Top P',
      repeat_penalty: 'Pénalité de répétition',
      n_predict: 'Max tokens',
      n_ctx: 'Contexte (n_ctx)',
      ragEnabled: 'Recherche RAG',
      ragTopK: 'Nb d’extraits (topK)',
      systemPrompt: 'Prompt système',
    };
    return map[key] ?? key;
  }

  // Maps a raw stored value to a friendly option label for select controls.
  private fmtOption(key: string, value: string): string {
    if (key === 'model') {
      const def = MODELS.find((m) => m.id === value);
      return def ? `${def.label} (${def.params})` : value;
    }
    if (key === 'n_ctx') return `${value} tokens`;
    return value;
  }

  private renderControl(
    row: HTMLElement,
    key: string,
    spec: any,
    currentValue: unknown
  ) {
    switch (spec.type) {
      case 'number':
        this.renderNumberControl(row, key, spec, currentValue);
        break;
      case 'select':
        this.renderSelectControl(row, key, spec, currentValue);
        break;
      case 'textarea':
        this.renderTextareaControl(row, key, spec, currentValue);
        break;
      case 'boolean':
        this.renderToggleControl(row, key, spec, currentValue);
        break;
    }
  }

  private renderNumberControl(row: HTMLElement, key: string, spec: any, currentValue: unknown) {
    const input = document.createElement('input');
    input.type = 'range';
    input.id = `setting-${key}`;
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(currentValue ?? spec.default);

    const valueDisplay = document.createElement('div');
    valueDisplay.className = 'setting-value';
    valueDisplay.textContent = String(currentValue ?? spec.default);

    input.addEventListener('input', () => {
      const val = parseFloat(input.value);
      valueDisplay.textContent = String(val);
      setSetting(key as any, val);
    });

    row.appendChild(input);
    row.appendChild(valueDisplay);
  }

  private renderSelectControl(row: HTMLElement, key: string, spec: any, currentValue: unknown) {
    const select = document.createElement('select');
    select.id = `setting-${key}`;
    for (const opt of spec.options) {
      const option = document.createElement('option');
      option.value = String(opt);
      option.textContent = this.fmtOption(key, String(opt));
      if (String(opt) === String(currentValue ?? spec.default)) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      const raw = select.value;
      // Number-typed selects (n_ctx) store integers; string-typed (model) store the id as-is.
      const isNumeric = typeof spec.options[0] === 'number';
      setSetting(key as any, isNumeric ? parseInt(raw, 10) : raw);
      // Switching the model requires a full reload to (re)download the new GGUF.
      if (key === 'model') this.onReloadModel?.();
    });
    row.appendChild(select);
  }

  private renderTextareaControl(row: HTMLElement, key: string, spec: any, currentValue: unknown) {
    const textarea = document.createElement('textarea');
    textarea.id = `setting-${key}`;
    textarea.value = String(currentValue ?? spec.default);
    textarea.rows = 5;
    textarea.addEventListener('input', () => setSetting(key as any, textarea.value));
    row.appendChild(textarea);
  }

  private renderToggleControl(row: HTMLElement, key: string, spec: any, currentValue: unknown) {
    const labelWrapper = document.createElement('label');
    labelWrapper.className = 'toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `setting-${key}`;
    input.checked = Boolean(currentValue ?? spec.default);
    const slider = document.createElement('span');
    slider.className = 'slider';
    labelWrapper.appendChild(input);
    labelWrapper.appendChild(slider);
    input.addEventListener('change', () => setSetting(key as any, input.checked));
    row.appendChild(labelWrapper);
  }

  private schema: SettingsSchema = SETTINGS_SCHEMA;

  collapse() {
    this.container.classList.add('collapsed');
  }

  expand() {
    this.container.classList.remove('collapsed');
  }

  isCollapsed(): boolean {
    return this.container.classList.contains('collapsed');
  }
}

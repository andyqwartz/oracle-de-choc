// src/ui/SettingsDrawer.ts
// Right panel: model status + settings generated from the schema, grouped by section.

import { SETTINGS_SCHEMA, type SettingsSchema } from '../settings/schema';
import { getSettings, setSetting } from '../settings/store';
import { MODELS, resolveModel, type ModelDef } from '../config';
import { searchGgufModels, ggufFileSize, fmtBytes, type HfModelCandidate } from '../llm/hf';
import type { ModelStatus } from '../types';

export class SettingsDrawer {
  private container: HTMLElement;
  private modelPanel!: HTMLElement;
  private cacheStatusEl!: HTMLElement;
  private onReloadModel: (() => void) | null = null;
  private onClearCache: (() => void) | null = null;
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

        <div class="setting-row">
          <label for="model-presets">Modèle pré-réglé</label>
          <div class="model-presets" id="model-presets"></div>
        </div>

        <div class="hf-search">
          <div class="hf-search-row">
            <input type="search" id="hf-search" placeholder="Chercher un modèle GGUF sur Hugging Face…" autocomplete="off" />
            <button class="btn" id="hf-search-go">Rechercher</button>
          </div>
          <div class="hf-results" id="hf-results"></div>
        </div>

        <div class="model-cache">
          <div class="model-cache-row">
            <span class="k">Stockage modèle</span>
            <span class="v" id="cache-status">…</span>
          </div>
          <div class="btn-row">
            <button class="btn" id="clear-cache">Vider le cache du modèle</button>
          </div>
          <p class="model-cache-hint">Supprime les fichiers .gguf téléchargés du stockage du navigateur. Le modèle actuel reste actif ; au prochain chargement il sera re-téléchargé.</p>
        </div>
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
    this.cacheStatusEl = this.container.querySelector('#cache-status')!;
    this.renderModelPanel({ state: 'idle' as const, progress: 0 });
    this.renderModelPresets();
    this.renderSettings();
    this.wireHfSearch();

    this.container.querySelector('#settings-close')!.addEventListener('click', () => {
      this.onRequestCloseCb?.();
    });

    this.container.querySelector('#clear-cache')!.addEventListener('click', () => {
      this.setCacheStatus('Suppression…');
      this.onClearCache?.();
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

  onClearCacheRequested(cb: () => void) {
    this.onClearCache = cb;
  }

  /** Update the "Stockage modèle" line (cache size / clear result). */
  setCacheStatus(text: string) {
    if (this.cacheStatusEl) this.cacheStatusEl.textContent = text;
  }

  // ---- Model presets (with live weight) ----
  private async renderModelPresets() {
    const box = this.container.querySelector('#model-presets')!;
    const selectedId = getSettings().model; // preset id or JSON for custom
    box.innerHTML = '';

    for (const m of MODELS) {
      const row = document.createElement('div');
      row.className = 'model-preset' + (m.id === selectedId ? ' active' : '');
      row.setAttribute('role', 'button');
      row.tabIndex = 0;

      const label = document.createElement('span');
      label.className = 'mp-label';
      label.textContent = `${m.label} (${m.params})`;
      const size = document.createElement('span');
      size.className = 'mp-size';
      size.textContent = '…';

      row.append(label, size);
      const onClick = () => this.applyModel(m.id);
      row.addEventListener('click', onClick);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      });
      box.appendChild(row);

      ggufFileSize(m.repo, m.file)
        .then((b) => {
          if (b) size.textContent = fmtBytes(b);
        })
        .catch(() => {
          size.textContent = ''; // fallback silent
        });
    }
  }

  // ---- HF search ----
  private wireHfSearch() {
    const input = this.container.querySelector('#hf-search') as HTMLInputElement;
    const goBtn = this.container.querySelector('#hf-search-go') as HTMLButtonElement;
    const results = this.container.querySelector('#hf-results')!;

    const run = async () => {
      results.innerHTML = '<div class="hf-status">Recherche…</div>';
      try {
        const items = await searchGgufModels(input.value);
        if (items.length === 0) {
          results.innerHTML = '<div class="hf-status">Aucun modèle léger trouvé (max ~3,5 Go).</div>';
          return;
        }
        results.innerHTML = '';
        const count = document.createElement('div');
        count.className = 'hf-status';
        count.textContent = `${items.length} modèle(s) léger(s) disponible(s) :`;
        results.appendChild(count);

        for (const it of items) {
          const item = document.createElement('div');
          item.className = 'hf-result';
          const txt = document.createElement('div');
          txt.className = 'hf-result-title';
          txt.textContent = `${it.label} — ${fmtBytes(it.sizeBytes)}`;
          const sub = document.createElement('div');
          sub.className = 'hf-result-repo';
          sub.textContent = it.repo;
          const btn = document.createElement('button');
          btn.className = 'btn';
          btn.textContent = 'Utiliser';
          btn.addEventListener('click', () => this.applyModel(it));
          item.append(txt, sub, btn);
          results.appendChild(item);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.innerHTML = `<div class="hf-status error">Erreur : ${msg}</div>`;
      }
    };

    goBtn.addEventListener('click', run);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') run();
    });
  }

  /** Apply a preset (by id) or a custom HF result, then reload the model. */
  private applyModel(m: string | HfModelCandidate) {
    if (typeof m === 'string') {
      setSetting('model' as any, m);
    } else {
      const def: ModelDef = {
        id: 'custom',
        repo: m.repo,
        file: m.file,
        label: m.label,
        params: fmtBytes(m.sizeBytes),
      };
      setSetting('model' as any, JSON.stringify(def));
    }
    this.renderModelPresets();
    this.onReloadModel?.();
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

    const current = resolveModel(getSettings().model);
    this.modelPanel.innerHTML = `
      <div class="model-row"><span class="k">Modèle</span><span class="v">${current.label}</span></div>
      <div class="model-row"><span class="k">Référence</span><span class="v">${current.repo}/${current.file}</span></div>
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

    const genKeys = ['temperature', 'top_k', 'top_p', 'repeat_penalty', 'n_predict', 'n_ctx'];
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

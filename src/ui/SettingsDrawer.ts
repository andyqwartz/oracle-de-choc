// src/ui/SettingsDrawer.ts
// Right panel: generates settings controls from the schema (section 6).
// One generic component driven by the schema — not nine hand-written controls.

import { SETTINGS_SCHEMA, type SettingsSchema } from '../settings/schema';
import { getSettings, setSetting } from '../settings/store';

export class SettingsDrawer {
  private container: HTMLElement;
  private schema: SettingsSchema = SETTINGS_SCHEMA;

  constructor() {
    this.container = document.createElement('aside');
    this.container.className = 'settings-drawer';
    this.container.setAttribute('role', 'complementary');
    this.container.setAttribute('aria-label', 'Paramètres');
  }

  render(): HTMLElement {
    this.container.innerHTML = '<h2>Paramètres</h2>';

    for (const [key, spec] of Object.entries(this.schema)) {
      const row = document.createElement('div');
      row.className = 'setting-row';

      const label = document.createElement('label');
      label.textContent = key;
      label.setAttribute('for', `setting-${key}`);
      row.appendChild(label);

      const currentValue = getSettings()[key as keyof typeof SETTINGS_SCHEMA];

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

      this.container.appendChild(row);
    }

    return this.container;
  }

  private renderNumberControl(
    row: HTMLElement,
    key: string,
    spec: Extract<SettingsSchema[keyof SettingsSchema], { type: 'number' }>,
    currentValue: unknown
  ) {
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

  private renderSelectControl(
    row: HTMLElement,
    key: string,
    spec: Extract<SettingsSchema[keyof SettingsSchema], { type: 'select' }>,
    currentValue: unknown
  ) {
    const select = document.createElement('select');
    select.id = `setting-${key}`;

    for (const opt of spec.options) {
      const option = document.createElement('option');
      option.value = String(opt);
      option.textContent = String(opt);
      if (opt === (currentValue ?? spec.default)) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      setSetting(key as any, parseInt(select.value, 10));
    });

    row.appendChild(select);
  }

  private renderTextareaControl(
    row: HTMLElement,
    key: string,
    spec: Extract<SettingsSchema[keyof SettingsSchema], { type: 'textarea' }>,
    currentValue: unknown
  ) {
    const textarea = document.createElement('textarea');
    textarea.id = `setting-${key}`;
    textarea.value = String(currentValue ?? spec.default);
    textarea.rows = 4;

    textarea.addEventListener('input', () => {
      setSetting(key as any, textarea.value);
    });

    row.appendChild(textarea);
  }

  private renderToggleControl(
    row: HTMLElement,
    key: string,
    spec: Extract<SettingsSchema[keyof SettingsSchema], { type: 'boolean' }>,
    currentValue: unknown
  ) {
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

    input.addEventListener('change', () => {
      setSetting(key as any, input.checked);
    });

    row.appendChild(labelWrapper);
  }
}

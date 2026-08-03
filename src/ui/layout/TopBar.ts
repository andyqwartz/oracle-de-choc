// src/ui/layout/TopBar.ts
// Top bar: brand, model status chip, and view toggles (sidebar / settings).

import type { ModelStatus } from '../../types';

export class TopBar {
  private container: HTMLElement;
  private modelChip!: HTMLElement;
  private modelChipLabel!: HTMLElement;
  private sidebarBtn!: HTMLButtonElement;
  private settingsBtn!: HTMLButtonElement;
  private onToggleSidebar: (() => void) | null = null;
  private onToggleSettings: (() => void) | null = null;

  constructor() {
    this.container = document.createElement('header');
    this.container.className = 'top-bar';
    this.container.setAttribute('role', 'banner');
  }

  render(): HTMLElement {
    this.container.innerHTML = `
      <button class="icon-btn ${''}" id="toggle-sidebar" aria-label="Afficher/masquer les épisodes">
        <span class="icon">☰</span>
      </button>

      <div class="brand">
        <span class="brand-mark"></span>
        <div>
          <div class="brand-name">Oracle de Choc</div>
          <div class="brand-sub">Méta de Choc · archives</div>
        </div>
      </div>

      <div class="top-bar-spacer"></div>

      <div class="model-chip" data-state="idle" id="model-chip">
        <span class="dot"></span>
        <span class="chip-label" id="model-chip-label">modèle en attente</span>
      </div>

      <button class="icon-btn active" id="toggle-settings" aria-label="Ouvrir les paramètres">
        <span class="icon">⚙</span>
      </button>
    `;

    this.modelChip = this.container.querySelector('#model-chip')!;
    this.modelChipLabel = this.container.querySelector('#model-chip-label')!;
    this.sidebarBtn = this.container.querySelector('#toggle-sidebar')!;
    this.settingsBtn = this.container.querySelector('#toggle-settings')!;

    this.sidebarBtn.addEventListener('click', () => this.onToggleSidebar?.());
    this.settingsBtn.addEventListener('click', () => this.onToggleSettings?.());

    return this.container;
  }

  setModelStatus(status: ModelStatus) {
    if (!this.modelChip) return;
    this.modelChip.dataset.state = status.state;
    switch (status.state) {
      case 'ready':
        this.modelChipLabel.textContent = 'modèle prêt';
        break;
      case 'loading':
        this.modelChipLabel.textContent =
          status.phase === 'download'
            ? `téléchargement ${Math.round(status.progress * 100)}%`
            : 'chargement en mémoire…';
        break;
      case 'error':
        this.modelChipLabel.textContent = 'modèle en erreur';
        break;
      default:
        this.modelChipLabel.textContent = 'modèle en attente';
    }
  }

  setSettingsButtonActive(active: boolean) {
    this.settingsBtn.classList.toggle('active', active);
  }

  onToggleSidebarClick(cb: () => void) {
    this.onToggleSidebar = cb;
  }

  onToggleSettingsClick(cb: () => void) {
    this.onToggleSettings = cb;
  }
}

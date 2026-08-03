// src/ui/layout/TopBar.ts
// Top bar: brand, model status chip, and view toggles (sidebar / settings).

import type { ModelStatus } from '../../types';

const ICONS = {
  menu: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  gear: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};

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
      <button class="icon-btn" id="toggle-sidebar" aria-label="Afficher ou masquer la liste des épisodes" title="Épisodes">
        <span class="icon">${ICONS.menu}</span>
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

      <button class="icon-btn active" id="toggle-settings" aria-label="Ouvrir les paramètres" title="Paramètres">
        <span class="icon">${ICONS.gear}</span>
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

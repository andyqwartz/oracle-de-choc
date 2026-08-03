// src/ui/layout/Sidebar.ts
// Left panel listing episodes from the index metadata.
// Today informational; tomorrow point of extension for filtering RAG by episode.

import type { IndexMeta } from '../../types';

export class Sidebar {
  private container: HTMLElement;
  private meta: IndexMeta | null = null;

  constructor() {
    this.container = document.createElement('aside');
    this.container.className = 'sidebar';
    this.container.setAttribute('role', 'complementary');
  }

  render(): HTMLElement {
    this.container.innerHTML = `
      <div class="sidebar-header">Méta de Choc</div>
      <div class="sidebar-list" id="sidebar-episode-list">
        <div class="sidebar-item" style="cursor:default;opacity:0.5">Chargement…</div>
      </div>
    `;
    return this.container;
  }

  setMeta(meta: IndexMeta) {
    this.meta = meta;
    this.renderEpisodeList();
  }

  private renderEpisodeList() {
    const list = this.container.querySelector('#sidebar-episode-list');
    if (!list) return;

    if (!this.meta) {
      list.innerHTML = '<div class="sidebar-item" style="cursor:default;opacity:0.5">Aucun épisode</div>';
      return;
    }

    list.innerHTML = `
      <div class="sidebar-item" style="cursor:default;opacity:0.5;font-weight:600">
        ${this.meta.episodeCount} épisode(s) · ${this.meta.chunkCount} chunks
      </div>
    `;
  }
}

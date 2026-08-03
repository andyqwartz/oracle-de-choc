// src/ui/layout/Sidebar.ts
// Left panel: searchable episode list. Clicking an episode filters future RAG queries
// to that episode (episode scoping).

export class Sidebar {
  private container: HTMLElement;
  private episodes: string[] = [];
  private searchTerm = '';
  private onSelectEpisode: ((episode: string | null) => void) | null = null;
  private selected: string | null = null;

  constructor() {
    this.container = document.createElement('aside');
    this.container.className = 'sidebar';
    this.container.setAttribute('role', 'complementary');
    this.container.setAttribute('aria-label', 'Liste des épisodes');
  }

  render(): HTMLElement {
    this.container.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-title">Méta de Choc</div>
        <div class="sidebar-sub">Épisodes · archives</div>
      </div>
      <div class="sidebar-search">
        <input type="search" id="sidebar-search-input" placeholder="Rechercher un épisode…" aria-label="Rechercher un épisode" />
      </div>
      <div class="sidebar-list" id="sidebar-episode-list"></div>
    `;

    const search = this.container.querySelector('#sidebar-search-input') as HTMLInputElement;
    search.addEventListener('input', () => {
      this.searchTerm = search.value.trim().toLowerCase();
      this.renderEpisodeList();
    });

    this.renderEpisodeList();
    return this.container;
  }

  setCollapsed(collapsed: boolean) {
    this.container.classList.toggle('collapsed', collapsed);
  }

  setEpisodes(episodes: string[]) {
    this.episodes = [...episodes].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    this.renderEpisodeList();
  }

  onSelect(cb: (episode: string | null) => void) {
    this.onSelectEpisode = cb;
  }

  selectEpisode(episode: string | null) {
    this.selected = episode;
    this.renderEpisodeList();
  }

  private renderEpisodeList() {
    const list = this.container.querySelector('#sidebar-episode-list');
    if (!list) return;

    const filtered = this.episodes.filter((e) =>
      this.searchTerm ? e.toLowerCase().includes(this.searchTerm) : true
    );

    if (this.episodes.length === 0) {
      list.innerHTML = '<div class="sidebar-item static">Chargement…</div>';
      return;
    }

    const frag = document.createDocumentFragment();

    if (!this.searchTerm) {
      const count = document.createElement('div');
      count.className = 'sidebar-item static';
      count.textContent = `${this.episodes.length} épisodes`;
      frag.appendChild(count);
    } else if (filtered.length === 0) {
      const none = document.createElement('div');
      none.className = 'sidebar-item static';
      none.textContent = 'Aucun épisode trouvé';
      frag.appendChild(none);
    }

    const max = this.searchTerm ? filtered.length : 200;
    for (const ep of filtered.slice(0, max)) {
      const item = document.createElement('div');
      item.className = 'sidebar-item' + (ep === this.selected ? ' active' : '');
      item.textContent = ep;
      item.addEventListener('click', () => {
        const next = this.selected === ep ? null : ep;
        this.selected = next;
        this.onSelectEpisode?.(next);
        this.renderEpisodeList();
      });
      frag.appendChild(item);
    }

    list.innerHTML = '';
    list.appendChild(frag);
  }
}

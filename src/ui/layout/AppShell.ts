// src/ui/layout/AppShell.ts
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { ChatPanel } from '../chat/ChatPanel';
import { SettingsDrawer } from '../SettingsDrawer';

const LS_KEY = 'oracle-de-choc:panels';

interface PanelState { sidebarCollapsed: boolean; settingsCollapsed: boolean; }

function loadPanelState(): PanelState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        sidebarCollapsed: !!p.sidebarCollapsed,
        settingsCollapsed: !!p.settingsCollapsed,
      };
    }
  } catch { /* ignore */ }
  return { sidebarCollapsed: false, settingsCollapsed: false };
}

export class AppShell {
  private root: HTMLElement;
  private topBar: TopBar;
  private sidebar: Sidebar;
  private chatPanel: ChatPanel;
  private settingsDrawer: SettingsDrawer;

  private panelState: PanelState = loadPanelState();
  selectedEpisode: string | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'app-shell';

    this.topBar = new TopBar();
    this.sidebar = new Sidebar();
    this.chatPanel = new ChatPanel();
    this.settingsDrawer = new SettingsDrawer();
  }

  private persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.panelState));
    } catch { /* ignore */ }
  }

  render(container: HTMLElement) {
    container.innerHTML = '';
    container.appendChild(this.root);

    // Sidebar (left)
    this.root.appendChild(this.sidebar.render());
    this.sidebar.setCollapsed(this.panelState.sidebarCollapsed);

    // Main column
    const main = document.createElement('div');
    main.className = 'app-main';
    main.appendChild(this.topBar.render());

    const body = document.createElement('div');
    body.style.cssText = 'flex:1;display:flex;min-height:0;';
    body.appendChild(this.chatPanel.render());
    body.appendChild(this.settingsDrawer.render());
    main.appendChild(body);

    this.root.appendChild(main);

    // Apply persisted settings panel state
    if (this.panelState.settingsCollapsed) {
      this.settingsDrawer.collapse();
      this.topBar.setSettingsButtonActive(false);
    } else {
      this.topBar.setSettingsButtonActive(true);
    }

    // Wire toggles
    this.topBar.onToggleSidebarClick(() => this.toggleSidebar());
    this.topBar.onToggleSettingsClick(() => this.toggleSettings());
    // Close buttons inside panels route here so AppShell stays the single source of truth.
    this.sidebar.onRequestClose(() => this.closeSidebar());
    this.settingsDrawer.onRequestClose(() => this.closeSettings());
  }

  get chatPanelInstance(): ChatPanel { return this.chatPanel; }
  get sidebarInstance(): Sidebar { return this.sidebar; }
  get settingsDrawerInstance(): SettingsDrawer { return this.settingsDrawer; }

  toggleSidebar() {
    if (this.panelState.sidebarCollapsed) this.openSidebar();
    else this.closeSidebar();
  }

  private openSidebar() {
    this.panelState.sidebarCollapsed = false;
    this.sidebar.setCollapsed(false);
    this.persist();
  }

  private closeSidebar() {
    this.panelState.sidebarCollapsed = true;
    this.sidebar.setCollapsed(true);
    this.persist();
  }

  toggleSettings() {
    if (this.panelState.settingsCollapsed) this.openSettings();
    else this.closeSettings();
  }

  private openSettings() {
    this.panelState.settingsCollapsed = false;
    this.settingsDrawer.expand();
    this.topBar.setSettingsButtonActive(true);
    this.persist();
  }

  private closeSettings() {
    this.panelState.settingsCollapsed = true;
    this.settingsDrawer.collapse();
    this.topBar.setSettingsButtonActive(false);
    this.persist();
  }

  // ---- Passthroughs ----
  setStatus(t: string, k?: 'default' | 'error' | 'loading' | 'ok') { this.chatPanel.setStatus(t, k); }
  setProgress(l: number, t: number) { this.chatPanel.setProgress(l, t); }
  setModelStatus(s: any) { this.topBar.setModelStatus(s); this.settingsDrawer.setModelStatus(s); }
  enableComposer() { this.chatPanel.enableComposer(); }
  setGenerating(g: boolean) { this.chatPanel.setGenerating(g); }
  onSend(cb: (t: string) => void) { this.chatPanel.onSend(cb); }
  onStop(cb: () => void) { this.chatPanel.onStop(cb); }
  onSidebarSelect(cb: (ep: string | null) => void) { this.sidebar.onSelect(cb); }
  onReloadModel(cb: () => void) { this.settingsDrawer.onReloadModelRequested(cb); }

  // Convenience accessors for main.ts
  appendMessage(role: 'user' | 'assistant' | 'system', content: string, sources?: any[]) {
    this.chatPanel.appendMessage(role, content, sources);
  }
  streamToken(text: string, isLast = false) {
    this.chatPanel.streamToken(text, isLast);
  }
  clearMessages() {
    this.chatPanel.clearMessages();
  }
  setEpisodes(eps: string[]) {
    this.sidebar.setEpisodes(eps);
  }
}

// src/ui/layout/AppShell.ts
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { ChatPanel } from '../chat/ChatPanel';
import { SettingsDrawer } from '../SettingsDrawer';

export class AppShell {
  private root: HTMLElement;
  private topBar: TopBar;
  private sidebar: Sidebar;
  private chatPanel: ChatPanel;
  private settingsDrawer: SettingsDrawer;

  private sidebarCollapsed = false;
  private settingsCollapsed = false;
  selectedEpisode: string | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'app-shell';

    this.topBar = new TopBar();
    this.sidebar = new Sidebar();
    this.chatPanel = new ChatPanel();
    this.settingsDrawer = new SettingsDrawer();
  }

  render(container: HTMLElement) {
    container.innerHTML = '';
    container.appendChild(this.root);

    // Sidebar (left)
    this.root.appendChild(this.sidebar.render());

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

    // Wire toggles
    this.topBar.onToggleSidebarClick(() => this.toggleSidebar());
    this.topBar.onToggleSettingsClick(() => this.toggleSettings());
  }

  get chatPanelInstance(): ChatPanel { return this.chatPanel; }
  get sidebarInstance(): Sidebar { return this.sidebar; }
  get settingsDrawerInstance(): SettingsDrawer { return this.settingsDrawer; }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.sidebar.setCollapsed(this.sidebarCollapsed);
  }

  toggleSettings() {
    this.settingsCollapsed = !this.settingsCollapsed;
    if (this.settingsCollapsed) {
      this.settingsDrawer.collapse();
      this.topBar.setSettingsButtonActive(false);
    } else {
      this.settingsDrawer.expand();
      this.topBar.setSettingsButtonActive(true);
    }
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

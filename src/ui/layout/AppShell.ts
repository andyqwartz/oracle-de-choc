// src/ui/layout/AppShell.ts
import { Sidebar } from './Sidebar';
import { ChatPanel } from '../chat/ChatPanel';
import { SettingsDrawer } from '../SettingsDrawer';

export class AppShell {
  private root: HTMLElement;
  private sidebar: Sidebar;
  private chatPanel: ChatPanel;
  private settingsDrawer: SettingsDrawer;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'app-shell';

    this.sidebar = new Sidebar();
    this.chatPanel = new ChatPanel();
    this.settingsDrawer = new SettingsDrawer();
  }

  render(container: HTMLElement) {
    container.innerHTML = '';
    container.appendChild(this.root);

    this.root.appendChild(this.sidebar.render());
    this.root.appendChild(this.chatPanel.render());
    this.root.appendChild(this.settingsDrawer.render());
  }

  setStatus(text: string) {
    this.chatPanel.setStatus(text);
  }

  setProgress(loaded: number, total: number) {
    this.chatPanel.setProgress(loaded, total);
  }

  enableComposer() {
    this.chatPanel.enableComposer();
  }

  appendMessage(role: 'user' | 'assistant' | 'system', content: string) {
    this.chatPanel.appendMessage(role, content);
  }

  clearMessages() {
    this.chatPanel.clearMessages();
  }
}

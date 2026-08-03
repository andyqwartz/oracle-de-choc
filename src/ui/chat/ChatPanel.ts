// src/ui/chat/ChatPanel.ts
// Center panel: MessageList + Composer + status bar.

import { MessageList } from './MessageList';
import { Composer } from './Composer';

export class ChatPanel {
  private container: HTMLElement;
  private messageList: MessageList;
  private composer: Composer;
  private statusBar: HTMLElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'chat-panel';

    this.messageList = new MessageList();
    this.composer = new Composer();

    // Status bar
    this.statusBar = document.createElement('div');
    this.statusBar.className = 'status-bar';
    this.statusBar.innerHTML = `
      <span id="status-text">Prêt</span>
      <div class="progress"><div class="progress-bar" id="progress-bar" style="width:0%"></div></div>
    `;

    // Assemble
    this.container.appendChild(this.messageList.render());
    this.container.appendChild(this.composer.render());
    this.container.appendChild(this.statusBar);

    // Welcome message
    this.messageList.renderWelcome();
  }

  render(): HTMLElement {
    return this.container;
  }

  appendMessage(role: 'user' | 'assistant' | 'system', content: string) {
    this.messageList.appendMessage(role, content);
  }

  streamToken(text: string, isLast = false) {
    this.messageList.appendStreamingText('assistant', text, isLast);
  }

  setStatus(text: string) {
    const el = this.statusBar.querySelector('#status-text');
    if (el) el.textContent = text;
  }

  setProgress(loaded: number, total: number) {
    const bar = this.statusBar.querySelector('#progress-bar') as HTMLElement;
    if (!bar) return;
    if (total > 0 && loaded > 0) {
      bar.style.width = `${Math.min(100, (loaded / total) * 100)}%`;
    } else {
      bar.style.width = '0%';
    }
  }

  enableComposer() {
    this.composer.setEnabled(true);
  }

  onSend(callback: (text: string) => void) {
    this.composer.onMessage(callback);
  }

  clearMessages() {
    this.messageList.clear();
    this.messageList.renderWelcome();
  }
}

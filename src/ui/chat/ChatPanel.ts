// src/ui/chat/ChatPanel.ts
// Center panel: MessageList + Composer + status bar.

import { MessageList } from './MessageList';
import { Composer } from './Composer';
import type { RagChunk } from '../../types';

export class ChatPanel {
  private container: HTMLElement;
  private messageList: MessageList;
  private composer: Composer;
  private statusBar: HTMLElement;

  private onSendCb: ((text: string) => void) | null = null;
  private onStopCb: (() => void) | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'chat-panel';

    this.messageList = new MessageList();
    this.composer = new Composer();

    // Status bar
    this.statusBar = document.createElement('div');
    this.statusBar.className = 'status-bar';
    this.statusBar.innerHTML = `
      <span class="status-text" id="status-text">Prêt</span>
      <div class="progress"><div class="progress-bar" id="progress-bar" style="width:0%"></div></div>
      <span class="progress-label" id="progress-label"></span>
    `;

    this.container.appendChild(this.messageList.render());
    this.container.appendChild(this.composer.render());
    this.container.appendChild(this.statusBar);

    this.messageList.renderWelcome((text) => this.onSendCb?.(text));

    this.composer.onMessage((text) => this.onSendCb?.(text));
    this.composer.onStopRequested(() => this.onStopCb?.());
  }

  render(): HTMLElement {
    return this.container;
  }

  appendMessage(role: 'user' | 'assistant' | 'system', content: string, sources?: RagChunk[]) {
    this.messageList.appendMessage(role, content, sources);
  }

  streamToken(text: string, isLast = false) {
    this.messageList.appendStreamingText('assistant', text, isLast);
  }

  setStatus(text: string, kind: 'default' | 'error' | 'loading' | 'ok' = 'default') {
    const el = this.statusBar.querySelector('#status-text') as HTMLElement;
    if (!el) return;
    el.textContent = text;
    el.className = 'status-text ' + (kind === 'default' ? '' : kind);
  }

  setProgress(loaded: number, total: number) {
    const bar = this.statusBar.querySelector('#progress-bar') as HTMLElement;
    const label = this.statusBar.querySelector('#progress-label') as HTMLElement;
    if (!bar) return;
    if (total > 0 && loaded > 0) {
      const pct = Math.min(100, (loaded / total) * 100);
      bar.style.width = `${pct}%`;
      if (label) label.textContent = `${pct.toFixed(0)}%`;
    } else {
      bar.style.width = '0%';
      if (label) label.textContent = '';
    }
  }

  enableComposer() {
    this.composer.setEnabled(true);
    this.composer.focus();
  }

  setGenerating(generating: boolean) {
    this.composer.setGenerating(generating);
  }

  onSend(cb: (text: string) => void) {
    this.onSendCb = cb;
  }

  onStop(cb: () => void) {
    this.onStopCb = cb;
  }

  clearMessages() {
    this.messageList.clear();
    this.messageList.renderWelcome((text) => this.onSendCb?.(text));
  }
}

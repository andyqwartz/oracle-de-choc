// src/ui/chat/MessageList.ts
// Renders the conversation with per-message metadata, source chips (RAG), and copy actions.

import type { RagChunk } from '../../types';

interface DisplayMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: RagChunk[];
  time?: string;
}

export class MessageList {
  private container: HTMLElement;
  private welcomeRendered = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'message-list';
    this.container.setAttribute('role', 'log');
    this.container.setAttribute('aria-live', 'polite');
    this.container.setAttribute('aria-relevant', 'additions');
  }

  render(): HTMLElement {
    return this.container;
  }

  private now(): string {
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  appendMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    sources?: RagChunk[]
  ) {
    if (role === 'system') {
      const div = document.createElement('div');
      div.className = 'message message-system';
      div.textContent = content;
      this.container.appendChild(div);
      this.scrollToBottom();
      return;
    }

    const div = document.createElement('div');
    div.className = `message message-${role}`;
    div.dataset.role = role;

    // Body
    const body = document.createElement('div');
    body.className = 'message-body';
    body.textContent = content;
    div.appendChild(body);

    // Sources (RAG citations)
    if (sources && sources.length > 0) {
      const sourcesEl = document.createElement('div');
      sourcesEl.className = 'sources';
      for (const s of sources.slice(0, 4)) {
        const chip = document.createElement('span');
        chip.className = 'source-chip';
        chip.textContent = s.episode;
        sourcesEl.appendChild(chip);
      }
      div.appendChild(sourcesEl);
    }

    // Meta row: time + copy
    const meta = document.createElement('div');
    meta.className = 'message-meta';

    const time = document.createElement('span');
    time.className = 'msg-time';
    time.textContent = this.now();
    meta.appendChild(time);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'copier';
    copyBtn.setAttribute('aria-label', 'Copier ce message');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(content).then(() => {
        copyBtn.textContent = 'copié ✓';
        setTimeout(() => (copyBtn.textContent = 'copier'), 1200);
      });
    });
    meta.appendChild(copyBtn);

    div.appendChild(meta);
    this.container.appendChild(div);
    this.scrollToBottom();
  }

  appendStreamingText(role: 'user' | 'assistant', text: string, isLast = false) {
    const messages = this.container.querySelectorAll('.message-assistant');
    let last = messages[messages.length - 1] as HTMLElement | undefined;

    if (!last || last.dataset.streaming !== 'true') {
      last = document.createElement('div');
      last.className = 'message message-assistant streaming';
      last.dataset.streaming = 'true';

      const body = document.createElement('div');
      body.className = 'message-body';
      last.appendChild(body);

      // Meta row
      const meta = document.createElement('div');
      meta.className = 'message-meta';
      const time = document.createElement('span');
      time.className = 'msg-time';
      time.textContent = this.now();
      meta.appendChild(time);
      last.appendChild(meta);

      this.container.appendChild(last);
    }

    const body = last.querySelector('.message-body') as HTMLElement;
    body.textContent = text;

    if (isLast) {
      last.dataset.streaming = 'false';
      last.classList.remove('streaming');
    }

    this.scrollToBottom();
  }

  // Attach RAG source chips to the last assistant message.
  attachSourcesToLast(sources: RagChunk[]) {
    const messages = this.container.querySelectorAll('.message-assistant');
    const last = messages[messages.length - 1] as HTMLElement | undefined;
    if (!last || !sources || sources.length === 0) return;
    if (last.querySelector('.sources')) return;

    const sourcesEl = document.createElement('div');
    sourcesEl.className = 'sources';
    for (const s of sources.slice(0, 4)) {
      const chip = document.createElement('span');
      chip.className = 'source-chip';
      chip.textContent = s.episode;
      sourcesEl.appendChild(chip);
    }
    last.appendChild(sourcesEl);
    this.scrollToBottom();
  }

  clear() {
    this.container.innerHTML = '';
    this.welcomeRendered = false;
  }

  renderWelcome(onSuggest: (text: string) => void) {
    if (this.welcomeRendered) return;
    this.welcomeRendered = true;

    const wrap = document.createElement('div');
    wrap.className = 'welcome';

    const mark = document.createElement('div');
    mark.className = 'welcome-mark';
    wrap.appendChild(mark);

    const title = document.createElement('h1');
    title.className = 'welcome-title';
    title.textContent = 'Oracle de Choc';
    wrap.appendChild(title);

    const text = document.createElement('p');
    text.className = 'welcome-text';
    text.textContent =
      'Un assistant construit à partir des archives du podcast Méta de Choc — pensée critique appliquée à soi. Pose une question, je m’appuie sur les transcriptions de ' +
      '242 épisodes pour t’apporter des pistes sourcées et bienveillantes.';
    wrap.appendChild(text);

    const suggestions = [
      'Pourquoi croit-on aux thérapies énergétiques ?',
      'Parle-moi de l’emprise sectaire',
      'La méditation est-elle universellement bénéfique ?',
      'Comment repérer un coaching dangereux ?',
    ];
    const sWrap = document.createElement('div');
    sWrap.className = 'welcome-suggestions';
    for (const s of suggestions) {
      const chip = document.createElement('button');
      chip.className = 'suggestion-chip';
      chip.textContent = s;
      chip.addEventListener('click', () => onSuggest(s));
      sWrap.appendChild(chip);
    }
    wrap.appendChild(sWrap);

    this.container.appendChild(wrap);
  }

  private scrollToBottom() {
    requestAnimationFrame(() => {
      this.container.scrollTop = this.container.scrollHeight;
    });
  }
}

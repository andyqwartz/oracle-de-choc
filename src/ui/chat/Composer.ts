// src/ui/chat/Composer.ts
// Input area: autogrowing textarea, Send button, and a Stop button while generating.

export class Composer {
  private container: HTMLElement;
  private input: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private hint: HTMLElement;
  private onSend: ((text: string) => void) | null = null;
  private onStop: (() => void) | null = null;
  private generating = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'composer';

    const box = document.createElement('div');
    box.className = 'composer-box';

    this.input = document.createElement('textarea');
    this.input.placeholder = 'Pose ta question…';
    this.input.setAttribute('aria-label', 'Message');
    this.input.rows = 1;
    this.input.disabled = true;

    this.sendBtn = document.createElement('button');
    this.sendBtn.className = 'send-btn';
    this.sendBtn.innerHTML = '<span class="icon">↑</span>';
    this.sendBtn.setAttribute('aria-label', 'Envoyer');
    this.sendBtn.disabled = true;

    this.stopBtn = document.createElement('button');
    this.stopBtn.className = 'stop-btn';
    this.stopBtn.innerHTML = '<span class="icon">■</span> Arrêter';
    this.stopBtn.style.display = 'none';
    this.stopBtn.setAttribute('aria-label', 'Arrêter la génération');

    // Autogrow
    const autoGrow = () => {
      this.input.style.height = 'auto';
      this.input.style.height = Math.min(this.input.scrollHeight, 180) + 'px';
    };
    this.input.addEventListener('input', autoGrow);
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.generating) {
        e.preventDefault();
        this.handleStop();
      }
    });

    this.sendBtn.addEventListener('click', () => this.handleSend());
    this.stopBtn.addEventListener('click', () => this.handleStop());

    box.appendChild(this.input);
    box.appendChild(this.stopBtn);
    box.appendChild(this.sendBtn);
    this.container.appendChild(box);

    this.hint = document.createElement('div');
    this.hint.className = 'composer-hint';
    this.hint.textContent = 'Entrée pour envoyer · Maj+Entrée pour nouvelle ligne · Échap pour arrêter';
    this.container.appendChild(this.hint);
  }

  render(): HTMLElement {
    return this.container;
  }

  onMessage(callback: (text: string) => void) {
    this.onSend = callback;
  }

  onStopRequested(callback: () => void) {
    this.onStop = callback;
  }

  setEnabled(enabled: boolean) {
    this.input.disabled = !enabled;
    this.sendBtn.disabled = !enabled;
    this.input.placeholder = enabled ? 'Pose ta question…' : 'Chargement en cours…';
  }

  setGenerating(generating: boolean) {
    this.generating = generating;
    this.stopBtn.style.display = generating ? 'inline-flex' : 'none';
    this.sendBtn.style.display = generating ? 'none' : 'inline-flex';
    this.input.disabled = generating;
    if (!generating) {
      this.sendBtn.disabled = this.input.disabled;
    }
  }

  getValue(): string {
    return this.input.value.trim();
  }

  clear() {
    this.input.value = '';
    this.input.style.height = 'auto';
  }

  focus() {
    this.input.focus();
  }

  private handleStop() {
    if (this.onStop) this.onStop();
  }

  private handleSend() {
    const text = this.getValue();
    if (!text || !this.onSend || this.generating) return;
    this.clear();
    this.onSend(text);
  }
}

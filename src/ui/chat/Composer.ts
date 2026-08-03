// src/ui/chat/Composer.ts
// Input area at the bottom of the chat panel.

export class Composer {
  private container: HTMLElement;
  private input: HTMLInputElement;
  private sendBtn: HTMLButtonElement;
  private onSend: ((text: string) => void) | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'composer';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = 'Pose ta question…';
    this.input.setAttribute('aria-label', 'Message input');
    this.input.disabled = true;

    this.sendBtn = document.createElement('button');
    this.sendBtn.textContent = 'Envoyer';
    this.sendBtn.disabled = true;

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    this.sendBtn.addEventListener('click', () => this.handleSend());

    this.container.appendChild(this.input);
    this.container.appendChild(this.sendBtn);
  }

  render(): HTMLElement {
    return this.container;
  }

  onMessage(callback: (text: string) => void) {
    this.onSend = callback;
  }

  setEnabled(enabled: boolean) {
    this.input.disabled = !enabled;
    this.sendBtn.disabled = !enabled;
    if (enabled) {
      this.input.placeholder = 'Pose ta question…';
    } else {
      this.input.placeholder = 'Chargement en cours…';
    }
  }

  getValue(): string {
    return this.input.value.trim();
  }

  clear() {
    this.input.value = '';
  }

  private handleSend() {
    const text = this.getValue();
    if (!text || !this.onSend) return;
    this.clear();
    this.onSend(text);
  }
}

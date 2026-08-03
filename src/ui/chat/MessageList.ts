// src/ui/chat/MessageList.ts
// Renders the conversation. Opens with the fixed welcome message (section 7).

export class MessageList {
  private container: HTMLElement;
  private welcomeRendered = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'message-list';
    this.container.setAttribute('role', 'log');
    this.container.setAttribute('aria-live', 'polite');
  }

  render(): HTMLElement {
    return this.container;
  }

  appendMessage(role: 'user' | 'assistant' | 'system', content: string) {
    const div = document.createElement('div');
    div.className = `message message-${role}`;
    div.textContent = content;
    this.container.appendChild(div);
    this.container.scrollTop = this.container.scrollHeight;
  }

  appendStreamingText(role: 'user' | 'assistant', text: string, isLast = false) {
    // Find the last assistant message
    const messages = this.container.querySelectorAll('.message-assistant');
    let lastAssistant = messages[messages.length - 1] as HTMLElement | undefined;

    if (!lastAssistant || lastAssistant.dataset.streaming !== 'true') {
      // No streaming message — create one
      lastAssistant = document.createElement('div');
      lastAssistant.className = 'message message-assistant';
      lastAssistant.dataset.streaming = 'true';
      this.container.appendChild(lastAssistant);
    }

    lastAssistant.textContent = text;

    if (isLast) {
      lastAssistant.dataset.streaming = 'false';
    }

    this.container.scrollTop = this.container.scrollHeight;
  }

  clear() {
    this.container.innerHTML = '';
    this.welcomeRendered = false;
  }

  renderWelcome() {
    if (this.welcomeRendered) return;
    this.welcomeRendered = true;
    this.appendMessage('system', `Bonjour, je suis Oracle de Choc — un assistant construit à partir des archives du podcast Méta de Choc. Je suis là pour explorer tes questions et tes expériences avec toi, pas pour te convaincre de quoi que ce soit. Dis-moi ce qui t'amène.`);
  }
}

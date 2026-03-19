import { BookingOSChatConfig, ChatMessage, ChatState } from './types';
import { getStyles } from './styles';

// SVG icons as strings
const ICONS = {
  chat: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
  close:
    '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
  send: '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
  check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  message:
    '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>',
};

export class ChatUI {
  private shadow: ShadowRoot;
  private container: HTMLElement;
  private isOpen = false;
  private state: ChatState = 'prechat';
  private messages: ChatMessage[] = [];
  private config: Required<
    Pick<
      BookingOSChatConfig,
      | 'position'
      | 'primaryColor'
      | 'title'
      | 'subtitle'
      | 'placeholder'
      | 'preChatFields'
      | 'zIndex'
      | 'offlineMessage'
    >
  > &
    BookingOSChatConfig;

  // DOM references
  private fab!: HTMLButtonElement;
  private window!: HTMLDivElement;
  private messagesContainer!: HTMLDivElement;
  private typingIndicator!: HTMLDivElement;
  private contentArea!: HTMLDivElement;
  private inputArea!: HTMLDivElement;
  private statusBanner: HTMLDivElement | null = null;

  // Callbacks
  public onStartChat:
    | ((data: { name: string; email?: string; phone?: string; message?: string }) => void)
    | null = null;
  public onSendMessage: ((content: string) => void) | null = null;
  public onSendOffline:
    | ((data: { name: string; email: string; phone?: string; message: string }) => void)
    | null = null;
  public onSendTyping: ((isTyping: boolean) => void) | null = null;

  constructor(config: BookingOSChatConfig) {
    this.config = {
      position: 'bottom-right',
      primaryColor: '#71907C',
      title: 'Chat with us',
      subtitle: 'We typically reply within minutes',
      placeholder: 'Type a message...',
      offlineMessage: "We're currently offline. Leave a message and we'll get back to you.",
      preChatFields: ['name', 'email'],
      zIndex: 999999,
      ...config,
    };

    // Create host element
    this.container = document.createElement('div');
    this.container.id = 'booking-os-chat';
    this.shadow = this.container.attachShadow({ mode: 'open' });
    document.body.appendChild(this.container);

    this.render();
  }

  private render(): void {
    const isLeft = this.config.position === 'bottom-left';

    // Inject styles
    const style = document.createElement('style');
    style.textContent = getStyles(this.config.primaryColor!, this.config.zIndex!);
    this.shadow.appendChild(style);

    // Create FAB
    this.fab = document.createElement('button');
    this.fab.className = `bos-chat-fab${isLeft ? ' left' : ''}`;
    this.fab.setAttribute('aria-label', 'Open chat');
    this.fab.innerHTML = `
      <span class="chat-icon">${ICONS.chat}</span>
      <span class="close-icon">${ICONS.close}</span>
    `;
    this.fab.addEventListener('click', () => this.toggle());
    this.shadow.appendChild(this.fab);

    // Create chat window
    this.window = document.createElement('div');
    this.window.className = `bos-chat-window${isLeft ? ' left' : ''}`;
    this.window.setAttribute('role', 'dialog');
    this.window.setAttribute('aria-label', 'Chat window');

    // Header
    const header = document.createElement('div');
    header.className = 'bos-chat-header';
    header.innerHTML = `
      <div class="bos-chat-header-info">
        <div class="bos-chat-header-title">${this.escapeHtml(this.config.title!)}</div>
        <div class="bos-chat-header-subtitle">${this.escapeHtml(this.config.subtitle!)}</div>
      </div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bos-chat-header-close';
    closeBtn.setAttribute('aria-label', 'Close chat');
    closeBtn.innerHTML = ICONS.close;
    closeBtn.addEventListener('click', () => this.toggle());
    header.appendChild(closeBtn);
    this.window.appendChild(header);

    // Content area (switches between prechat, chat, offline)
    this.contentArea = document.createElement('div');
    this.contentArea.style.display = 'contents';
    this.window.appendChild(this.contentArea);

    // Powered by footer
    const powered = document.createElement('div');
    powered.className = 'bos-chat-powered';
    powered.innerHTML =
      'Powered by <a href="https://businesscommandcentre.com" target="_blank" rel="noopener">BookingOS</a>';
    this.window.appendChild(powered);

    this.shadow.appendChild(this.window);

    // Render initial state
    this.renderState();
  }

  private renderState(): void {
    // Clear content area
    this.contentArea.innerHTML = '';

    switch (this.state) {
      case 'prechat':
        this.renderPreChatForm();
        break;
      case 'connecting':
        this.renderConnecting();
        break;
      case 'chat':
        this.renderChat();
        break;
      case 'offline':
        this.renderOfflineForm();
        break;
    }
  }

  private renderPreChatForm(): void {
    const form = document.createElement('div');
    form.className = 'bos-chat-prechat';

    const title = document.createElement('div');
    title.className = 'bos-chat-form-title';
    title.textContent = 'Start a conversation';
    form.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'bos-chat-form-subtitle';
    subtitle.textContent = this.config.subtitle!;
    form.appendChild(subtitle);

    const fields = this.config.preChatFields!;
    const inputs: Record<string, HTMLInputElement | HTMLTextAreaElement> = {};

    if (fields.includes('name')) {
      const group = this.createFormGroup('Name', 'text', 'Your name', true);
      inputs.name = group.querySelector('input')!;
      form.appendChild(group);
    }

    if (fields.includes('email')) {
      const group = this.createFormGroup('Email', 'email', 'your@email.com', false);
      inputs.email = group.querySelector('input')!;
      form.appendChild(group);
    }

    if (fields.includes('phone')) {
      const group = this.createFormGroup('Phone', 'tel', '+1 (555) 000-0000', false);
      inputs.phone = group.querySelector('input')!;
      form.appendChild(group);
    }

    // Message field
    const msgGroup = document.createElement('div');
    msgGroup.className = 'bos-chat-form-group';
    const msgLabel = document.createElement('label');
    msgLabel.textContent = 'Message';
    msgGroup.appendChild(msgLabel);
    const msgInput = document.createElement('textarea');
    msgInput.placeholder = 'How can we help?';
    msgInput.rows = 3;
    inputs.message = msgInput;
    msgGroup.appendChild(msgInput);
    form.appendChild(msgGroup);

    const submitBtn = document.createElement('button');
    submitBtn.className = 'bos-chat-form-submit';
    submitBtn.textContent = 'Start Chat';
    submitBtn.addEventListener('click', () => {
      const name = (inputs.name as HTMLInputElement)?.value?.trim();
      if (fields.includes('name') && !name) {
        (inputs.name as HTMLInputElement).style.borderColor = '#ef4444';
        (inputs.name as HTMLInputElement).focus();
        return;
      }

      const data: { name: string; email?: string; phone?: string; message?: string } = {
        name: name || 'Visitor',
      };
      if (inputs.email) data.email = (inputs.email as HTMLInputElement).value.trim() || undefined;
      if (inputs.phone) data.phone = (inputs.phone as HTMLInputElement).value.trim() || undefined;
      if (inputs.message)
        data.message = (inputs.message as HTMLTextAreaElement).value.trim() || undefined;

      this.onStartChat?.(data);
    });

    // Enter key on last input submits
    const allInputs = Object.values(inputs);
    allInputs.forEach((input) => {
      input.addEventListener('keydown', ((e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && input.tagName !== 'TEXTAREA') {
          e.preventDefault();
          submitBtn.click();
        }
      }) as EventListener);
    });

    form.appendChild(submitBtn);
    this.contentArea.appendChild(form);
  }

  private renderConnecting(): void {
    const div = document.createElement('div');
    div.className = 'bos-chat-prechat';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';

    const text = document.createElement('div');
    text.className = 'bos-chat-form-subtitle';
    text.textContent = 'Connecting...';
    text.style.textAlign = 'center';
    div.appendChild(text);

    this.contentArea.appendChild(div);
  }

  private renderChat(): void {
    // Messages container
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.className = 'bos-chat-messages';

    // Welcome message if no messages yet
    if (this.messages.length === 0) {
      const welcome = document.createElement('div');
      welcome.className = 'bos-chat-welcome';
      welcome.innerHTML = `
        <div class="bos-chat-welcome-icon">${ICONS.message}</div>
        <div>Chat started. We'll be with you shortly.</div>
      `;
      this.messagesContainer.appendChild(welcome);
    }

    // Render existing messages
    this.messages.forEach((msg) => {
      this.messagesContainer.appendChild(this.createMessageElement(msg));
    });

    // Typing indicator
    this.typingIndicator = document.createElement('div');
    this.typingIndicator.className = 'bos-chat-typing';
    this.typingIndicator.innerHTML = `
      <span class="bos-chat-typing-dot"></span>
      <span class="bos-chat-typing-dot"></span>
      <span class="bos-chat-typing-dot"></span>
    `;
    this.messagesContainer.appendChild(this.typingIndicator);

    this.contentArea.appendChild(this.messagesContainer);

    // Input area
    this.inputArea = document.createElement('div');
    this.inputArea.className = 'bos-chat-input';

    const textarea = document.createElement('textarea');
    textarea.placeholder = this.config.placeholder!;
    textarea.rows = 1;

    const sendBtn = document.createElement('button');
    sendBtn.className = 'bos-chat-input-send';
    sendBtn.setAttribute('aria-label', 'Send message');
    sendBtn.innerHTML = ICONS.send;
    sendBtn.disabled = true;

    // Auto-resize textarea
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
      sendBtn.disabled = !textarea.value.trim();
    });

    // Typing indicator
    let typingTimeout: ReturnType<typeof setTimeout> | null = null;
    textarea.addEventListener('input', () => {
      this.onSendTyping?.(true);
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        this.onSendTyping?.(false);
      }, 2000);
    });

    // Send on Enter (Shift+Enter for newline)
    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (textarea.value.trim()) {
          this.handleSend(textarea, sendBtn);
        }
      }
    });

    sendBtn.addEventListener('click', () => {
      if (textarea.value.trim()) {
        this.handleSend(textarea, sendBtn);
      }
    });

    this.inputArea.appendChild(textarea);
    this.inputArea.appendChild(sendBtn);
    this.contentArea.appendChild(this.inputArea);

    // Scroll to bottom
    this.scrollToBottom();
  }

  private renderOfflineForm(): void {
    const form = document.createElement('div');
    form.className = 'bos-chat-offline';

    const title = document.createElement('div');
    title.className = 'bos-chat-form-title';
    title.textContent = 'Leave a message';
    form.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'bos-chat-form-subtitle';
    subtitle.textContent = this.config.offlineMessage!;
    form.appendChild(subtitle);

    const inputs: Record<string, HTMLInputElement | HTMLTextAreaElement> = {};

    const nameGroup = this.createFormGroup('Name', 'text', 'Your name', true);
    inputs.name = nameGroup.querySelector('input')!;
    form.appendChild(nameGroup);

    const emailGroup = this.createFormGroup('Email', 'email', 'your@email.com', true);
    inputs.email = emailGroup.querySelector('input')!;
    form.appendChild(emailGroup);

    const phoneGroup = this.createFormGroup('Phone', 'tel', '+1 (555) 000-0000 (optional)', false);
    inputs.phone = phoneGroup.querySelector('input')!;
    form.appendChild(phoneGroup);

    const msgGroup = document.createElement('div');
    msgGroup.className = 'bos-chat-form-group';
    const msgLabel = document.createElement('label');
    msgLabel.innerHTML = 'Message<span class="required">*</span>';
    msgGroup.appendChild(msgLabel);
    const msgInput = document.createElement('textarea');
    msgInput.placeholder = 'How can we help?';
    msgInput.rows = 4;
    inputs.message = msgInput;
    msgGroup.appendChild(msgInput);
    form.appendChild(msgGroup);

    const submitBtn = document.createElement('button');
    submitBtn.className = 'bos-chat-form-submit';
    submitBtn.textContent = 'Send Message';
    submitBtn.addEventListener('click', () => {
      const name = (inputs.name as HTMLInputElement).value.trim();
      const email = (inputs.email as HTMLInputElement).value.trim();
      const message = (inputs.message as HTMLTextAreaElement).value.trim();

      // Validate
      let valid = true;
      if (!name) {
        (inputs.name as HTMLInputElement).style.borderColor = '#ef4444';
        valid = false;
      }
      if (!email || !email.includes('@')) {
        (inputs.email as HTMLInputElement).style.borderColor = '#ef4444';
        valid = false;
      }
      if (!message) {
        (inputs.message as HTMLTextAreaElement).style.borderColor = '#ef4444';
        valid = false;
      }

      if (!valid) return;

      const data = {
        name,
        email,
        phone: (inputs.phone as HTMLInputElement).value.trim() || undefined,
        message,
      };

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      this.onSendOffline?.(data);
    });

    form.appendChild(submitBtn);
    this.contentArea.appendChild(form);
  }

  private createFormGroup(
    label: string,
    type: string,
    placeholder: string,
    required: boolean,
  ): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'bos-chat-form-group';

    const labelEl = document.createElement('label');
    labelEl.innerHTML =
      this.escapeHtml(label) + (required ? '<span class="required">*</span>' : '');
    group.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = type;
    input.placeholder = placeholder;
    input.required = required;

    // Clear error state on input
    input.addEventListener('input', () => {
      input.style.borderColor = '';
    });

    group.appendChild(input);
    return group;
  }

  private createMessageElement(msg: ChatMessage): HTMLDivElement {
    const el = document.createElement('div');
    el.className = `bos-chat-message ${msg.direction}`;
    el.setAttribute('data-message-id', msg.id);

    let html = '';
    if (msg.direction === 'outbound' && msg.senderName) {
      html += `<div class="bos-chat-message-sender">${this.escapeHtml(msg.senderName)}</div>`;
    }
    html += `<div>${this.escapeHtml(msg.content)}</div>`;

    const time = this.formatTime(msg.createdAt);
    html += `<div class="bos-chat-message-time">${time}</div>`;

    el.innerHTML = html;
    return el;
  }

  private handleSend(textarea: HTMLTextAreaElement, sendBtn: HTMLButtonElement): void {
    const content = textarea.value.trim();
    if (!content) return;

    // Add message to UI immediately (optimistic)
    const msg: ChatMessage = {
      id: `local-${Date.now()}`,
      content,
      direction: 'inbound',
      createdAt: new Date().toISOString(),
    };
    this.addMessage(msg);

    // Clear input
    textarea.value = '';
    textarea.style.height = 'auto';
    sendBtn.disabled = true;

    // Stop typing
    this.onSendTyping?.(false);

    // Send via socket
    this.onSendMessage?.(content);
  }

  // Public methods

  toggle(): void {
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      this.window.classList.add('open');
      this.fab.classList.add('open');
      this.fab.setAttribute('aria-label', 'Close chat');

      // Focus input if in chat state
      if (this.state === 'chat') {
        const textarea = this.inputArea?.querySelector('textarea');
        if (textarea) setTimeout(() => textarea.focus(), 100);
      }
    } else {
      this.window.classList.remove('open');
      this.fab.classList.remove('open');
      this.fab.setAttribute('aria-label', 'Open chat');
    }
  }

  addMessage(msg: ChatMessage): void {
    this.messages.push(msg);

    if (this.state === 'chat' && this.messagesContainer) {
      // Remove welcome message if present
      const welcome = this.messagesContainer.querySelector('.bos-chat-welcome');
      if (welcome) welcome.remove();

      // Insert before typing indicator
      const msgEl = this.createMessageElement(msg);
      this.messagesContainer.insertBefore(msgEl, this.typingIndicator);
      this.scrollToBottom();
    }
  }

  showPreChat(): void {
    this.state = 'prechat';
    this.renderState();
  }

  showConnecting(): void {
    this.state = 'connecting';
    this.renderState();
  }

  showChat(): void {
    this.state = 'chat';
    this.renderState();
  }

  showOffline(): void {
    this.state = 'offline';
    this.renderState();
  }

  showOfflineSuccess(): void {
    this.contentArea.innerHTML = '';
    const success = document.createElement('div');
    success.className = 'bos-chat-offline-success';
    success.innerHTML = `
      <div class="bos-chat-offline-success-icon">${ICONS.check}</div>
      <h3>Message sent!</h3>
      <p>We'll get back to you as soon as possible.</p>
    `;
    this.contentArea.appendChild(success);
  }

  showTyping(isTyping: boolean): void {
    if (this.typingIndicator) {
      this.typingIndicator.classList.toggle('visible', isTyping);
      if (isTyping) this.scrollToBottom();
    }
  }

  showStatus(message: string, type: 'info' | 'error' | 'success' = 'info'): void {
    this.clearStatus();
    this.statusBanner = document.createElement('div');
    this.statusBanner.className = `bos-chat-status${type !== 'info' ? ` ${type}` : ''}`;
    this.statusBanner.textContent = message;

    // Insert after header
    const header = this.window.querySelector('.bos-chat-header');
    if (header && header.nextSibling) {
      this.window.insertBefore(this.statusBanner, header.nextSibling);
    }

    // Auto-clear after 5 seconds for non-errors
    if (type !== 'error') {
      setTimeout(() => this.clearStatus(), 5000);
    }
  }

  clearStatus(): void {
    if (this.statusBanner) {
      this.statusBanner.remove();
      this.statusBanner = null;
    }
  }

  updateTitle(title: string): void {
    const titleEl = this.shadow.querySelector('.bos-chat-header-title');
    if (titleEl) titleEl.textContent = title;
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      requestAnimationFrame(() => {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      });
    }
  }

  private formatTime(isoString: string): string {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  destroy(): void {
    this.container.remove();
  }
}

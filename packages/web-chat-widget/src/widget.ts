import { BookingOSChatConfig, ChatMessage } from './types';
import { ChatUI } from './ui';
import { ChatSocket } from './socket';

export class BookingOSChatWidget {
  private ui: ChatUI;
  private socket: ChatSocket;
  private config: BookingOSChatConfig;
  private started = false;
  private conversationId: string | null = null;

  constructor(config: BookingOSChatConfig) {
    if (!config.businessId) {
      throw new Error('BookingOSChat: businessId is required');
    }
    if (!config.apiUrl) {
      throw new Error('BookingOSChat: apiUrl is required');
    }

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

    // Create UI
    this.ui = new ChatUI(this.config);

    // Create socket connection
    this.socket = new ChatSocket(
      { apiUrl: this.config.apiUrl, businessId: this.config.businessId },
      {
        onMessage: (msg: ChatMessage) => this.handleMessage(msg),
        onSessionCreated: (data) => this.handleSessionCreated(data),
        onChatStarted: (data) => this.handleChatStarted(data),
        onError: (err) => this.handleError(err),
        onAck: (_data) => {
          // Message acknowledged by server — could update UI with delivered status
        },
        onTyping: (data) => this.ui.showTyping(data.isTyping),
      },
    );

    // Wire up UI callbacks
    this.ui.onStartChat = (data) => this.startChat(data);
    this.ui.onSendMessage = (content) => this.sendMessage(content);
    this.ui.onSendOffline = (data) => this.sendOfflineForm(data);
    this.ui.onSendTyping = (isTyping) => this.socket.sendTyping(isTyping);

    // Connect socket
    this.socket.connect().catch((err) => {
      console.error('BookingOSChat: Failed to connect', err);
    });
  }

  private startChat(data: {
    name: string;
    email?: string;
    phone?: string;
    message?: string;
  }): void {
    if (!this.socket.isConnected()) {
      this.ui.showStatus('Connecting... Please wait.', 'info');
      // Retry after a short delay
      setTimeout(() => {
        if (this.socket.isConnected()) {
          this.startChat(data);
        } else {
          this.ui.showStatus('Unable to connect. Please try again.', 'error');
        }
      }, 2000);
      return;
    }

    this.ui.showConnecting();
    this.socket.startChat(data);
  }

  private sendMessage(content: string): void {
    this.socket.sendMessage(content);
  }

  private sendOfflineForm(data: {
    name: string;
    email: string;
    phone?: string;
    message: string;
  }): void {
    this.socket.sendOfflineForm(data);
    // Show success after a small delay (optimistic)
    setTimeout(() => {
      this.ui.showOfflineSuccess();
    }, 500);
  }

  private handleMessage(msg: ChatMessage): void {
    if (!this.started) {
      this.started = true;
      this.ui.showChat();
    }
    this.ui.addMessage(msg);
  }

  private handleSessionCreated(data: {
    sessionId: string;
    sessionToken: string;
    businessName: string;
  }): void {
    if (data.businessName) {
      this.ui.updateTitle(data.businessName);
    }
  }

  private handleChatStarted(data: { conversationId: string }): void {
    this.conversationId = data.conversationId;
    this.started = true;
    this.ui.clearStatus();
    this.ui.showChat();
  }

  private handleError(err: { message: string }): void {
    console.error('BookingOSChat error:', err.message);
    this.ui.showStatus(err.message, 'error');
  }

  // Public API

  open(): void {
    this.ui.toggle();
  }

  destroy(): void {
    this.socket.disconnect();
    this.ui.destroy();
  }
}

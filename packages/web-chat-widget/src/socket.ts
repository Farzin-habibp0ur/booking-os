import { ChatMessage, ChatSocketCallbacks } from './types';

declare const io: any;

export class ChatSocket {
  private socket: any = null;
  private config: { apiUrl: string; businessId: string };
  private sessionToken: string | null = null;
  private callbacks: ChatSocketCallbacks;

  constructor(
    config: { apiUrl: string; businessId: string },
    callbacks: ChatSocketCallbacks,
  ) {
    this.config = config;
    this.callbacks = callbacks;

    // Restore session token from localStorage if available
    try {
      this.sessionToken = localStorage.getItem(
        `bos_chat_session_${config.businessId}`,
      );
    } catch {
      // localStorage may not be available
    }
  }

  async connect(): Promise<void> {
    // Wait for socket.io to be available
    if (typeof io === 'undefined') {
      await this.loadSocketIO();
    }

    const authPayload: Record<string, string> = {
      businessId: this.config.businessId,
    };

    if (this.sessionToken) {
      authPayload.sessionToken = this.sessionToken;
    }

    this.socket = io(`${this.config.apiUrl}/web-chat`, {
      auth: authPayload,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.setupListeners();
  }

  private async loadSocketIO(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (typeof io !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `${this.config.apiUrl}/socket.io/socket.io.js`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Fallback to CDN
        const cdnScript = document.createElement('script');
        cdnScript.src =
          'https://cdn.socket.io/4.7.5/socket.io.min.js';
        cdnScript.async = true;
        cdnScript.onload = () => resolve();
        cdnScript.onerror = () =>
          reject(new Error('Failed to load socket.io client'));
        document.head.appendChild(cdnScript);
      };
      document.head.appendChild(script);
    });
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      // Connection established
    });

    this.socket.on('session:created', (data: { sessionId: string; sessionToken: string; businessName: string }) => {
      this.sessionToken = data.sessionToken;
      try {
        localStorage.setItem(
          `bos_chat_session_${this.config.businessId}`,
          data.sessionToken,
        );
      } catch {
        // localStorage may not be available
      }
      this.callbacks.onSessionCreated(data);
    });

    this.socket.on('chat:started', (data: { conversationId: string }) => {
      this.callbacks.onChatStarted(data);
    });

    this.socket.on('chat:message', (msg: ChatMessage) => {
      this.callbacks.onMessage(msg);
    });

    this.socket.on('chat:ack', (data: { messageId: string }) => {
      this.callbacks.onAck(data);
    });

    this.socket.on('chat:typing', (data: { isTyping: boolean; name?: string }) => {
      this.callbacks.onTyping(data);
    });

    this.socket.on('chat:error', (err: { message: string }) => {
      this.callbacks.onError(err);
    });

    this.socket.on('connect_error', (err: Error) => {
      this.callbacks.onError({ message: `Connection error: ${err.message}` });
    });

    this.socket.on('disconnect', (reason: string) => {
      if (reason === 'io server disconnect') {
        // Server disconnected — try to reconnect
        this.socket?.connect();
      }
    });
  }

  startChat(data: { name: string; email?: string; phone?: string; message?: string }): void {
    if (!this.socket?.connected) {
      this.callbacks.onError({ message: 'Not connected. Please wait...' });
      return;
    }
    this.socket.emit('chat:start', data);
  }

  sendMessage(content: string): void {
    if (!this.socket?.connected) {
      this.callbacks.onError({ message: 'Not connected. Please wait...' });
      return;
    }
    this.socket.emit('chat:message', { content });
  }

  sendOfflineForm(data: { name: string; email: string; phone?: string; message: string }): void {
    if (!this.socket?.connected) {
      this.callbacks.onError({ message: 'Not connected. Please wait...' });
      return;
    }
    this.socket.emit('chat:offline', data);
  }

  sendTyping(isTyping: boolean): void {
    if (this.socket?.connected) {
      this.socket.emit('chat:typing', { isTyping });
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export interface BookingOSChatConfig {
  businessId: string;
  apiUrl: string;
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  offlineMessage?: string;
  preChatFields?: Array<'name' | 'email' | 'phone'>;
  zIndex?: number;
}

export interface ChatMessage {
  id: string;
  content: string;
  direction: 'inbound' | 'outbound';
  senderName?: string;
  createdAt: string;
}

export interface SessionData {
  sessionId: string;
  sessionToken: string;
  businessName: string;
}

export interface ChatStartedData {
  conversationId: string;
}

export interface ChatErrorData {
  message: string;
}

export interface ChatAckData {
  messageId: string;
}

export type ChatState = 'prechat' | 'connecting' | 'chat' | 'offline';

export interface ChatSocketCallbacks {
  onMessage: (msg: ChatMessage) => void;
  onSessionCreated: (data: SessionData) => void;
  onChatStarted: (data: ChatStartedData) => void;
  onError: (err: ChatErrorData) => void;
  onAck: (data: ChatAckData) => void;
  onTyping: (data: { isTyping: boolean; name?: string }) => void;
}

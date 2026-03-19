import { BookingOSChatWidget } from './widget';
import { BookingOSChatConfig } from './types';

// Expose as global
(window as any).BookingOSChat = {
  init(config: BookingOSChatConfig): BookingOSChatWidget {
    return new BookingOSChatWidget(config);
  },
};

export { BookingOSChatWidget, BookingOSChatConfig };

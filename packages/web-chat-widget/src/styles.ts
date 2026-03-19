export function getStyles(primaryColor: string, zIndex: number): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    :host {
      all: initial;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* FAB (Floating Action Button) */
    .bos-chat-fab {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${primaryColor};
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: ${zIndex};
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .bos-chat-fab:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
    }

    .bos-chat-fab:active {
      transform: scale(0.95);
    }

    .bos-chat-fab.left {
      right: auto;
      left: 20px;
    }

    .bos-chat-fab svg {
      width: 24px;
      height: 24px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .bos-chat-fab .close-icon {
      display: none;
    }

    .bos-chat-fab.open .chat-icon {
      display: none;
    }

    .bos-chat-fab.open .close-icon {
      display: block;
    }

    /* Chat Window */
    .bos-chat-window {
      position: fixed;
      bottom: 88px;
      right: 20px;
      width: 380px;
      height: 520px;
      max-height: calc(100vh - 108px);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 12px 40px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04);
      z-index: ${zIndex};
      display: none;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(10px) scale(0.95);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .bos-chat-window.open {
      display: flex;
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .bos-chat-window.left {
      right: auto;
      left: 20px;
    }

    /* Header */
    .bos-chat-header {
      background: ${primaryColor};
      color: #fff;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .bos-chat-header-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .bos-chat-header-title {
      font-size: 16px;
      font-weight: 600;
      line-height: 1.3;
    }

    .bos-chat-header-subtitle {
      font-size: 12px;
      opacity: 0.85;
      line-height: 1.3;
    }

    .bos-chat-header-close {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      padding: 4px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease;
    }

    .bos-chat-header-close:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .bos-chat-header-close svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Messages Area */
    .bos-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #FCFCFD;
    }

    .bos-chat-messages::-webkit-scrollbar {
      width: 4px;
    }

    .bos-chat-messages::-webkit-scrollbar-track {
      background: transparent;
    }

    .bos-chat-messages::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }

    /* Message Bubbles */
    .bos-chat-message {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      animation: messageIn 0.2s ease;
    }

    @keyframes messageIn {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .bos-chat-message.inbound {
      align-self: flex-end;
      background: ${primaryColor};
      color: #fff;
      border-bottom-right-radius: 4px;
    }

    .bos-chat-message.outbound {
      align-self: flex-start;
      background: #f1f5f9;
      color: #1e293b;
      border-bottom-left-radius: 4px;
    }

    .bos-chat-message-sender {
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 2px;
      opacity: 0.7;
    }

    .bos-chat-message-time {
      font-size: 11px;
      margin-top: 4px;
      opacity: 0.6;
    }

    /* Typing Indicator */
    .bos-chat-typing {
      align-self: flex-start;
      padding: 12px 16px;
      background: #f1f5f9;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      display: none;
      align-items: center;
      gap: 4px;
    }

    .bos-chat-typing.visible {
      display: flex;
    }

    .bos-chat-typing-dot {
      width: 6px;
      height: 6px;
      background: #94a3b8;
      border-radius: 50%;
      animation: typingBounce 1.4s infinite ease-in-out;
    }

    .bos-chat-typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .bos-chat-typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typingBounce {
      0%, 80%, 100% {
        transform: scale(0.6);
        opacity: 0.4;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }

    /* Input Area */
    .bos-chat-input {
      padding: 12px 16px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      background: #fff;
      flex-shrink: 0;
    }

    .bos-chat-input textarea {
      flex: 1;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 12px;
      padding: 10px 14px;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.4;
      resize: none;
      outline: none;
      max-height: 100px;
      min-height: 40px;
      color: #1e293b;
      transition: border-color 0.15s ease, background 0.15s ease;
    }

    .bos-chat-input textarea::placeholder {
      color: #94a3b8;
    }

    .bos-chat-input textarea:focus {
      border-color: ${primaryColor};
      background: #fff;
    }

    .bos-chat-input-send {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: ${primaryColor};
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s ease, transform 0.1s ease;
    }

    .bos-chat-input-send:hover {
      filter: brightness(0.9);
    }

    .bos-chat-input-send:active {
      transform: scale(0.95);
    }

    .bos-chat-input-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .bos-chat-input-send svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Pre-chat Form */
    .bos-chat-prechat,
    .bos-chat-offline {
      flex: 1;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
      background: #FCFCFD;
    }

    .bos-chat-form-title {
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
    }

    .bos-chat-form-subtitle {
      font-size: 13px;
      color: #64748b;
      margin-top: -8px;
    }

    .bos-chat-form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .bos-chat-form-group label {
      font-size: 13px;
      font-weight: 500;
      color: #475569;
    }

    .bos-chat-form-group label .required {
      color: #ef4444;
      margin-left: 2px;
    }

    .bos-chat-form-group input,
    .bos-chat-form-group textarea {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 12px;
      padding: 10px 14px;
      font-family: inherit;
      font-size: 14px;
      color: #1e293b;
      outline: none;
      transition: border-color 0.15s ease, background 0.15s ease;
    }

    .bos-chat-form-group input:focus,
    .bos-chat-form-group textarea:focus {
      border-color: ${primaryColor};
      background: #fff;
    }

    .bos-chat-form-group input::placeholder,
    .bos-chat-form-group textarea::placeholder {
      color: #94a3b8;
    }

    .bos-chat-form-group textarea {
      resize: none;
      min-height: 80px;
    }

    .bos-chat-form-submit {
      background: ${primaryColor};
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 12px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: filter 0.15s ease, transform 0.1s ease;
    }

    .bos-chat-form-submit:hover {
      filter: brightness(0.9);
    }

    .bos-chat-form-submit:active {
      transform: scale(0.98);
    }

    .bos-chat-form-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Status banner */
    .bos-chat-status {
      padding: 8px 16px;
      font-size: 12px;
      text-align: center;
      background: #fef3c7;
      color: #92400e;
      flex-shrink: 0;
    }

    .bos-chat-status.error {
      background: #fee2e2;
      color: #991b1b;
    }

    .bos-chat-status.success {
      background: #dcfce7;
      color: #166534;
    }

    /* Welcome message */
    .bos-chat-welcome {
      text-align: center;
      padding: 32px 20px;
      color: #64748b;
      font-size: 13px;
    }

    .bos-chat-welcome-icon {
      width: 48px;
      height: 48px;
      background: ${primaryColor}15;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 12px;
    }

    .bos-chat-welcome-icon svg {
      width: 24px;
      height: 24px;
      stroke: ${primaryColor};
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Offline success */
    .bos-chat-offline-success {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
      text-align: center;
      gap: 12px;
      background: #FCFCFD;
    }

    .bos-chat-offline-success-icon {
      width: 56px;
      height: 56px;
      background: #dcfce7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .bos-chat-offline-success-icon svg {
      width: 28px;
      height: 28px;
      stroke: #16a34a;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .bos-chat-offline-success h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }

    .bos-chat-offline-success p {
      font-size: 13px;
      color: #64748b;
    }

    /* Powered by */
    .bos-chat-powered {
      padding: 6px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      background: #fff;
      border-top: 1px solid #f1f5f9;
      flex-shrink: 0;
    }

    .bos-chat-powered a {
      color: #64748b;
      text-decoration: none;
      font-weight: 500;
    }

    .bos-chat-powered a:hover {
      text-decoration: underline;
    }

    /* Mobile Responsive */
    @media (max-width: 480px) {
      .bos-chat-window {
        bottom: 0;
        right: 0;
        left: 0;
        width: 100%;
        height: 100%;
        max-height: 100vh;
        border-radius: 0;
      }

      .bos-chat-window.left {
        left: 0;
        right: 0;
      }

      .bos-chat-fab {
        bottom: 16px;
        right: 16px;
      }

      .bos-chat-fab.left {
        left: 16px;
        right: auto;
      }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .bos-chat-window,
      .bos-chat-fab,
      .bos-chat-message,
      .bos-chat-typing-dot {
        animation: none !important;
        transition: none !important;
      }
    }
  `;
}

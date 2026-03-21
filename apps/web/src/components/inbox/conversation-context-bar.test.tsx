import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConversationContextBar } from './conversation-context-bar';

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'inbox.context_messaging_window': 'Messaging window',
        'inbox.context_human_agent_window': 'Human agent window',
        'inbox.context_window_expired': 'Messaging window expired',
        'inbox.context_no_window': 'No recent customer message',
        'inbox.context_subject': 'Subject',
        'inbox.context_sms_opted_in': 'SMS — Customer opted in',
        'inbox.context_sms_opted_out': 'SMS — Customer has opted out',
        'inbox.wa_template_required': 'Outside 24h window — use a template',
      };
      return map[key] || key;
    },
  }),
}));

describe('ConversationContextBar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Facebook/Instagram messaging windows', () => {
    it('shows 24h messaging window when customer messaged within 24h', () => {
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
      render(<ConversationContextBar channel="FACEBOOK" lastCustomerMessageAt={tenHoursAgo} />);
      const bar = screen.getByTestId('conversation-context-bar');
      expect(bar).toHaveTextContent('Messaging window');
      expect(bar).toHaveClass('bg-blue-50');
    });

    it('shows human agent window when customer messaged between 24h and 7d ago', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      render(<ConversationContextBar channel="FACEBOOK" lastCustomerMessageAt={twoDaysAgo} />);
      const bar = screen.getByTestId('conversation-context-bar');
      expect(bar).toHaveTextContent('Human agent window');
      expect(bar).toHaveClass('bg-amber-50');
    });

    it('shows expired when customer messaged more than 7d ago', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      render(<ConversationContextBar channel="FACEBOOK" lastCustomerMessageAt={tenDaysAgo} />);
      const bar = screen.getByTestId('conversation-context-bar');
      expect(bar).toHaveTextContent('Messaging window expired');
      expect(bar).toHaveClass('bg-red-50');
    });

    it('shows warning when no customer message exists', () => {
      render(<ConversationContextBar channel="FACEBOOK" />);
      const bar = screen.getByTestId('conversation-context-bar');
      expect(bar).toHaveTextContent('No recent customer message');
      expect(bar).toHaveClass('bg-amber-50');
    });

    it('works the same for INSTAGRAM channel', () => {
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
      render(<ConversationContextBar channel="INSTAGRAM" lastCustomerMessageAt={tenHoursAgo} />);
      const bar = screen.getByTestId('conversation-context-bar');
      expect(bar).toHaveTextContent('Messaging window');
    });
  });

  describe('Email context', () => {
    it('shows email subject when provided', () => {
      render(
        <ConversationContextBar
          channel="EMAIL"
          conversationMetadata={{ subject: 'Booking inquiry' }}
        />,
      );
      const bar = screen.getByTestId('conversation-context-bar');
      expect(bar).toHaveTextContent('Subject: Booking inquiry');
      expect(bar).toHaveClass('bg-blue-50');
    });

    it('renders nothing for EMAIL without subject', () => {
      const { container } = render(
        <ConversationContextBar channel="EMAIL" conversationMetadata={{}} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('SMS context', () => {
    it('shows opted-in status by default', () => {
      render(<ConversationContextBar channel="SMS" />);
      const bar = screen.getByTestId('conversation-context-bar');
      expect(bar).toHaveTextContent('SMS — Customer opted in');
      expect(bar).toHaveClass('bg-sage-50');
    });

    it('shows opted-out warning when smsOptOut is true', () => {
      render(<ConversationContextBar channel="SMS" conversationMetadata={{ smsOptOut: true }} />);
      const bar = screen.getByTestId('conversation-context-bar');
      expect(bar).toHaveTextContent('SMS — Customer has opted out');
      expect(bar).toHaveClass('bg-red-50');
    });
  });

  describe('WhatsApp context', () => {
    it('shows template required when no customer message exists', () => {
      render(<ConversationContextBar channel="WHATSAPP" />);
      const bar = screen.getByTestId('conversation-context-bar');
      expect(bar).toHaveTextContent('Outside 24h window — use a template');
      expect(bar).toHaveClass('bg-amber-50');
    });

    it('shows template required when window expired', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      render(<ConversationContextBar channel="WHATSAPP" lastCustomerMessageAt={twoDaysAgo} />);
      const bar = screen.getByTestId('conversation-context-bar');
      expect(bar).toHaveTextContent('Outside 24h window — use a template');
    });

    it('shows window closing warning when near expiry', () => {
      // 20h ago = 80% of 24h
      const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
      render(<ConversationContextBar channel="WHATSAPP" lastCustomerMessageAt={twentyHoursAgo} />);
      const bar = screen.getByTestId('conversation-context-bar');
      expect(bar).toHaveTextContent('WhatsApp window closing');
    });

    it('renders nothing when WhatsApp window is well open', () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
      const { container } = render(
        <ConversationContextBar channel="WHATSAPP" lastCustomerMessageAt={fiveHoursAgo} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('shows "Use template" button when onUseTemplate provided and window expired', () => {
      const mockFn = jest.fn();
      render(<ConversationContextBar channel="WHATSAPP" onUseTemplate={mockFn} />);
      const btn = screen.getByTestId('use-template-btn');
      expect(btn).toBeInTheDocument();
    });
  });

  describe('Other channels', () => {
    it('renders nothing for WEB_CHAT', () => {
      const { container } = render(<ConversationContextBar channel="WEB_CHAT" />);
      expect(container.firstChild).toBeNull();
    });
  });
});

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChannelBadge } from './channel-badge';

describe('ChannelBadge', () => {
  it('renders WhatsApp badge with label', () => {
    render(<ChannelBadge channel="WHATSAPP" />);
    expect(screen.getByTestId('channel-badge-whatsapp')).toHaveTextContent('WhatsApp');
  });

  it('renders Instagram badge with label', () => {
    render(<ChannelBadge channel="INSTAGRAM" />);
    expect(screen.getByTestId('channel-badge-instagram')).toHaveTextContent('Instagram');
  });

  it('renders Facebook badge with Messenger label', () => {
    render(<ChannelBadge channel="FACEBOOK" />);
    expect(screen.getByTestId('channel-badge-facebook')).toHaveTextContent('Messenger');
  });

  it('renders SMS badge with label', () => {
    render(<ChannelBadge channel="SMS" />);
    expect(screen.getByTestId('channel-badge-sms')).toHaveTextContent('SMS');
  });

  it('renders EMAIL badge with label', () => {
    render(<ChannelBadge channel="EMAIL" />);
    expect(screen.getByTestId('channel-badge-email')).toHaveTextContent('Email');
  });

  it('renders WEB_CHAT badge with label', () => {
    render(<ChannelBadge channel="WEB_CHAT" />);
    expect(screen.getByTestId('channel-badge-web_chat')).toHaveTextContent('Web Chat');
  });

  it('hides label when showLabel is false', () => {
    render(<ChannelBadge channel="WHATSAPP" showLabel={false} />);
    const badge = screen.getByTestId('channel-badge-whatsapp');
    expect(badge).not.toHaveTextContent('WhatsApp');
  });

  it('handles unknown channel gracefully', () => {
    render(<ChannelBadge channel="UNKNOWN_CHANNEL" />);
    const badge = screen.getByTestId('channel-badge-unknown_channel');
    expect(badge).toHaveTextContent('UNKNOWN_CHANNEL');
    expect(badge).toHaveClass('bg-slate-100', 'text-slate-600');
  });

  it('applies sm size classes by default', () => {
    render(<ChannelBadge channel="WHATSAPP" />);
    const badge = screen.getByTestId('channel-badge-whatsapp');
    expect(badge).toHaveClass('px-1.5', 'py-0.5', 'text-[10px]');
  });

  it('applies md size classes when specified', () => {
    render(<ChannelBadge channel="WHATSAPP" size="md" />);
    const badge = screen.getByTestId('channel-badge-whatsapp');
    expect(badge).toHaveClass('px-2', 'text-xs');
  });

  it('applies custom className', () => {
    render(<ChannelBadge channel="WHATSAPP" className="ml-2" />);
    const badge = screen.getByTestId('channel-badge-whatsapp');
    expect(badge).toHaveClass('ml-2');
  });
});

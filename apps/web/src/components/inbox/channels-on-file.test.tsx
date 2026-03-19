import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChannelsOnFile } from './channels-on-file';

describe('ChannelsOnFile', () => {
  it('renders available channels from phone', () => {
    render(<ChannelsOnFile channels={{ phone: '+1234567890' }} />);
    const container = screen.getByTestId('channels-on-file');
    expect(container).toHaveTextContent('WhatsApp');
    expect(container).toHaveTextContent('SMS');
    expect(container).toHaveTextContent('+1234567890');
  });

  it('renders email channel', () => {
    render(<ChannelsOnFile channels={{ email: 'test@example.com' }} />);
    const container = screen.getByTestId('channels-on-file');
    expect(container).toHaveTextContent('Email');
    expect(container).toHaveTextContent('test@example.com');
  });

  it('renders Instagram channel', () => {
    render(<ChannelsOnFile channels={{ instagramUserId: 'ig_12345' }} />);
    const container = screen.getByTestId('channels-on-file');
    expect(container).toHaveTextContent('Instagram');
    expect(container).toHaveTextContent('ig_12345');
  });

  it('renders Facebook channel', () => {
    render(<ChannelsOnFile channels={{ facebookPsid: 'fb_98765' }} />);
    const container = screen.getByTestId('channels-on-file');
    expect(container).toHaveTextContent('Messenger');
    expect(container).toHaveTextContent('fb_98765');
  });

  it('renders Web Chat channel', () => {
    render(<ChannelsOnFile channels={{ webChatSessionId: 'session_abc' }} />);
    const container = screen.getByTestId('channels-on-file');
    expect(container).toHaveTextContent('Web Chat');
    expect(container).toHaveTextContent('session_abc');
  });

  it('returns null when no channels are provided', () => {
    const { container } = render(<ChannelsOnFile channels={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all channel types together', () => {
    render(
      <ChannelsOnFile
        channels={{
          phone: '+1234567890',
          email: 'test@example.com',
          instagramUserId: 'ig_user',
          facebookPsid: 'fb_user',
          webChatSessionId: 'session_123',
        }}
      />,
    );
    const container = screen.getByTestId('channels-on-file');
    expect(container).toHaveTextContent('WhatsApp');
    expect(container).toHaveTextContent('SMS');
    expect(container).toHaveTextContent('Email');
    expect(container).toHaveTextContent('Instagram');
    expect(container).toHaveTextContent('Messenger');
    expect(container).toHaveTextContent('Web Chat');
  });

  it('shows Channels header', () => {
    render(<ChannelsOnFile channels={{ phone: '+1234567890' }} />);
    expect(screen.getByText('Channels')).toBeInTheDocument();
  });

  it('should have aria-label for accessibility', () => {
    render(<ChannelsOnFile channels={{ phone: '+1234567890' }} />);
    const container = screen.getByTestId('channels-on-file');
    expect(container).toHaveAttribute('aria-label', 'Customer channels on file');
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReplyChannelSwitcher } from './reply-channel-switcher';

describe('ReplyChannelSwitcher', () => {
  const defaultProps = {
    currentChannel: 'WHATSAPP',
    availableChannels: ['WHATSAPP', 'INSTAGRAM', 'SMS'],
    onChannelChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders current channel label', () => {
    render(<ReplyChannelSwitcher {...defaultProps} />);
    expect(screen.getByTestId('reply-channel-switcher')).toHaveTextContent('WhatsApp');
  });

  it('returns null when only 1 channel is available', () => {
    const { container } = render(
      <ReplyChannelSwitcher
        currentChannel="WHATSAPP"
        availableChannels={['WHATSAPP']}
        onChannelChange={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when no channels are available', () => {
    const { container } = render(
      <ReplyChannelSwitcher
        currentChannel="WHATSAPP"
        availableChannels={[]}
        onChannelChange={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('opens dropdown on click', () => {
    render(<ReplyChannelSwitcher {...defaultProps} />);
    fireEvent.click(screen.getByTestId('reply-channel-switcher'));
    expect(screen.getByTestId('reply-channel-option-whatsapp')).toBeInTheDocument();
    expect(screen.getByTestId('reply-channel-option-instagram')).toBeInTheDocument();
    expect(screen.getByTestId('reply-channel-option-sms')).toBeInTheDocument();
  });

  it('calls onChannelChange when option selected', () => {
    render(<ReplyChannelSwitcher {...defaultProps} />);
    fireEvent.click(screen.getByTestId('reply-channel-switcher'));
    fireEvent.click(screen.getByTestId('reply-channel-option-instagram'));
    expect(defaultProps.onChannelChange).toHaveBeenCalledWith('INSTAGRAM');
  });

  it('closes dropdown after selection', () => {
    render(<ReplyChannelSwitcher {...defaultProps} />);
    fireEvent.click(screen.getByTestId('reply-channel-switcher'));
    fireEvent.click(screen.getByTestId('reply-channel-option-instagram'));
    expect(screen.queryByTestId('reply-channel-option-whatsapp')).not.toBeInTheDocument();
  });

  it('closes dropdown on outside click', () => {
    render(
      <div>
        <div data-testid="outside">outside</div>
        <ReplyChannelSwitcher {...defaultProps} />
      </div>,
    );
    fireEvent.click(screen.getByTestId('reply-channel-switcher'));
    expect(screen.getByTestId('reply-channel-option-whatsapp')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('reply-channel-option-whatsapp')).not.toBeInTheDocument();
  });

  it('highlights current channel in dropdown', () => {
    render(<ReplyChannelSwitcher {...defaultProps} />);
    fireEvent.click(screen.getByTestId('reply-channel-switcher'));
    const currentOption = screen.getByTestId('reply-channel-option-whatsapp');
    expect(currentOption).toHaveClass('bg-slate-50', 'font-medium');
  });
});

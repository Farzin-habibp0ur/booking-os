import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReplyChannelSwitcher, getDefaultReplyChannel } from './reply-channel-switcher';

describe('getDefaultReplyChannel', () => {
  it('returns last inbound channel when available', () => {
    const result = getDefaultReplyChannel('WHATSAPP', ['WHATSAPP', 'SMS', 'EMAIL'], 'SMS');
    expect(result).toBe('SMS');
  });

  it('falls back to conversation channel when last inbound not in available', () => {
    const result = getDefaultReplyChannel('WHATSAPP', ['WHATSAPP', 'EMAIL'], 'INSTAGRAM');
    expect(result).toBe('WHATSAPP');
  });

  it('falls back to first available when conversation channel not available', () => {
    const result = getDefaultReplyChannel('INSTAGRAM', ['SMS', 'EMAIL'], 'FACEBOOK');
    expect(result).toBe('SMS');
  });

  it('returns conversation channel when available list is empty', () => {
    const result = getDefaultReplyChannel('WHATSAPP', []);
    expect(result).toBe('WHATSAPP');
  });
});

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

  it('should have proper ARIA attributes', () => {
    render(<ReplyChannelSwitcher {...defaultProps} />);
    const trigger = screen.getByTestId('reply-channel-switcher');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-label', 'Switch reply channel');
  });

  it('should set aria-expanded to true when open', () => {
    render(<ReplyChannelSwitcher {...defaultProps} />);
    const trigger = screen.getByTestId('reply-channel-switcher');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('should have listbox role on dropdown', () => {
    render(<ReplyChannelSwitcher {...defaultProps} />);
    fireEvent.click(screen.getByTestId('reply-channel-switcher'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('should have option role with aria-selected on dropdown items', () => {
    render(<ReplyChannelSwitcher {...defaultProps} />);
    fireEvent.click(screen.getByTestId('reply-channel-switcher'));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(screen.getByTestId('reply-channel-option-whatsapp')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('reply-channel-option-instagram')).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('should close dropdown on Escape key', () => {
    render(<ReplyChannelSwitcher {...defaultProps} />);
    fireEvent.click(screen.getByTestId('reply-channel-switcher'));
    expect(screen.getByTestId('reply-channel-option-whatsapp')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('reply-channel-switcher').parentElement!, {
      key: 'Escape',
    });
    expect(screen.queryByTestId('reply-channel-option-whatsapp')).not.toBeInTheDocument();
  });

  it('should navigate options with arrow keys and select with Enter', () => {
    render(<ReplyChannelSwitcher {...defaultProps} />);
    fireEvent.click(screen.getByTestId('reply-channel-switcher'));
    const container = screen.getByTestId('reply-channel-switcher').parentElement!;

    // Arrow down to first option
    fireEvent.keyDown(container, { key: 'ArrowDown' });
    // Arrow down to second option (Instagram)
    fireEvent.keyDown(container, { key: 'ArrowDown' });
    // Select with Enter
    fireEvent.keyDown(container, { key: 'Enter' });

    expect(defaultProps.onChannelChange).toHaveBeenCalledWith('INSTAGRAM');
  });

  describe('disabled channels', () => {
    it('renders disabled channel with reduced opacity', () => {
      render(
        <ReplyChannelSwitcher
          {...defaultProps}
          disabledChannels={{ INSTAGRAM: 'Messaging window expired' }}
        />,
      );
      fireEvent.click(screen.getByTestId('reply-channel-switcher'));
      const igOption = screen.getByTestId('reply-channel-option-instagram');
      expect(igOption).toHaveClass('opacity-40', 'cursor-not-allowed');
      expect(igOption).toHaveAttribute('aria-disabled', 'true');
      expect(igOption).toHaveAttribute('title', 'Messaging window expired');
    });

    it('does not call onChannelChange when clicking disabled channel', () => {
      const onChange = jest.fn();
      render(
        <ReplyChannelSwitcher
          {...defaultProps}
          onChannelChange={onChange}
          disabledChannels={{ INSTAGRAM: 'Messaging window expired' }}
        />,
      );
      fireEvent.click(screen.getByTestId('reply-channel-switcher'));
      fireEvent.click(screen.getByTestId('reply-channel-option-instagram'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not select disabled channel via Enter key', () => {
      const onChange = jest.fn();
      render(
        <ReplyChannelSwitcher
          currentChannel="WHATSAPP"
          availableChannels={['WHATSAPP', 'INSTAGRAM']}
          onChannelChange={onChange}
          disabledChannels={{ INSTAGRAM: 'Window expired' }}
        />,
      );
      fireEvent.click(screen.getByTestId('reply-channel-switcher'));
      const container = screen.getByTestId('reply-channel-switcher').parentElement!;

      // Arrow down to first option (WHATSAPP at index 0)
      fireEvent.keyDown(container, { key: 'ArrowDown' });
      // Arrow down to second option (INSTAGRAM at index 1)
      fireEvent.keyDown(container, { key: 'ArrowDown' });
      // Try to select with Enter
      fireEvent.keyDown(container, { key: 'Enter' });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('allows selecting non-disabled channels normally', () => {
      const onChange = jest.fn();
      render(
        <ReplyChannelSwitcher
          {...defaultProps}
          onChannelChange={onChange}
          disabledChannels={{ INSTAGRAM: 'Messaging window expired' }}
        />,
      );
      fireEvent.click(screen.getByTestId('reply-channel-switcher'));
      fireEvent.click(screen.getByTestId('reply-channel-option-sms'));
      expect(onChange).toHaveBeenCalledWith('SMS');
    });

    it('non-disabled channels have aria-disabled false', () => {
      render(
        <ReplyChannelSwitcher
          {...defaultProps}
          disabledChannels={{ INSTAGRAM: 'Window expired' }}
        />,
      );
      fireEvent.click(screen.getByTestId('reply-channel-switcher'));
      const smsOption = screen.getByTestId('reply-channel-option-sms');
      expect(smsOption).toHaveAttribute('aria-disabled', 'false');
    });
  });
});

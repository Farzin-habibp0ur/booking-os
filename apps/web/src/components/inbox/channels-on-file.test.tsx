import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChannelsOnFile } from './channels-on-file';

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map = {
        'inbox.channels_on_file': 'Channels',
        'inbox.add_email': 'Add email',
        'inbox.add_phone': 'Add phone',
        'inbox.add_save': 'Save',
        'inbox.invalid_email': 'Please enter a valid email address',
        'inbox.invalid_phone': 'Please enter a valid phone number (e.g., +12025551234)',
      };
      return map[key as keyof typeof map] || key;
    },
  }),
}));

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

  it('returns null when no channels are provided and no onAddIdentifier', () => {
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

  describe('add identifier actions', () => {
    it('shows add email button when email is missing and onAddIdentifier is provided', () => {
      render(<ChannelsOnFile channels={{ phone: '+1234567890' }} onAddIdentifier={jest.fn()} />);
      expect(screen.getByTestId('add-email-button')).toHaveTextContent('Add email');
    });

    it('shows add phone button when phone is missing and onAddIdentifier is provided', () => {
      render(
        <ChannelsOnFile channels={{ email: 'test@example.com' }} onAddIdentifier={jest.fn()} />,
      );
      expect(screen.getByTestId('add-phone-button')).toHaveTextContent('Add phone');
    });

    it('does not show add buttons when onAddIdentifier is not provided', () => {
      render(<ChannelsOnFile channels={{ phone: '+1234567890' }} />);
      expect(screen.queryByTestId('add-email-button')).not.toBeInTheDocument();
    });

    it('does not show add email button when email already exists', () => {
      render(
        <ChannelsOnFile
          channels={{ phone: '+1234567890', email: 'test@example.com' }}
          onAddIdentifier={jest.fn()}
        />,
      );
      expect(screen.queryByTestId('add-email-button')).not.toBeInTheDocument();
    });

    it('does not show add phone button when phone already exists', () => {
      render(
        <ChannelsOnFile
          channels={{ phone: '+1234567890', email: 'test@example.com' }}
          onAddIdentifier={jest.fn()}
        />,
      );
      expect(screen.queryByTestId('add-phone-button')).not.toBeInTheDocument();
    });

    it('shows input field when add email button is clicked', () => {
      render(<ChannelsOnFile channels={{ phone: '+1234567890' }} onAddIdentifier={jest.fn()} />);
      fireEvent.click(screen.getByTestId('add-email-button'));
      expect(screen.getByTestId('add-email-input')).toBeInTheDocument();
      expect(screen.getByTestId('add-email-input')).toHaveAttribute('type', 'email');
    });

    it('shows input field when add phone button is clicked', () => {
      render(
        <ChannelsOnFile channels={{ email: 'test@example.com' }} onAddIdentifier={jest.fn()} />,
      );
      fireEvent.click(screen.getByTestId('add-phone-button'));
      expect(screen.getByTestId('add-phone-input')).toBeInTheDocument();
      expect(screen.getByTestId('add-phone-input')).toHaveAttribute('type', 'tel');
    });

    it('calls onAddIdentifier with email value on save', () => {
      const onAdd = jest.fn();
      render(<ChannelsOnFile channels={{ phone: '+1234567890' }} onAddIdentifier={onAdd} />);
      fireEvent.click(screen.getByTestId('add-email-button'));
      const input = screen.getByTestId('add-email-input');
      fireEvent.change(input, { target: { value: 'new@example.com' } });
      fireEvent.click(screen.getByText('Save'));
      expect(onAdd).toHaveBeenCalledWith('email', 'new@example.com');
    });

    it('calls onAddIdentifier with phone value on Enter', () => {
      const onAdd = jest.fn();
      render(<ChannelsOnFile channels={{ email: 'test@example.com' }} onAddIdentifier={onAdd} />);
      fireEvent.click(screen.getByTestId('add-phone-button'));
      const input = screen.getByTestId('add-phone-input');
      fireEvent.change(input, { target: { value: '+9876543210' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onAdd).toHaveBeenCalledWith('phone', '+9876543210');
    });

    it('closes input on Escape key', () => {
      render(<ChannelsOnFile channels={{ phone: '+1234567890' }} onAddIdentifier={jest.fn()} />);
      fireEvent.click(screen.getByTestId('add-email-button'));
      expect(screen.getByTestId('add-email-input')).toBeInTheDocument();
      fireEvent.keyDown(screen.getByTestId('add-email-input'), { key: 'Escape' });
      expect(screen.queryByTestId('add-email-input')).not.toBeInTheDocument();
      // Button should reappear
      expect(screen.getByTestId('add-email-button')).toBeInTheDocument();
    });

    it('renders component with add buttons even when no channels exist', () => {
      render(<ChannelsOnFile channels={{}} onAddIdentifier={jest.fn()} />);
      expect(screen.getByTestId('channels-on-file')).toBeInTheDocument();
      expect(screen.getByTestId('add-email-button')).toBeInTheDocument();
      expect(screen.getByTestId('add-phone-button')).toBeInTheDocument();
    });

    it('shows error for invalid email', () => {
      const onAdd = jest.fn();
      render(<ChannelsOnFile channels={{ phone: '+1234567890' }} onAddIdentifier={onAdd} />);
      fireEvent.click(screen.getByTestId('add-email-button'));
      const input = screen.getByTestId('add-email-input');
      fireEvent.change(input, { target: { value: 'not-an-email' } });
      fireEvent.click(screen.getByText('Save'));
      expect(screen.getByTestId('add-identifier-error')).toHaveTextContent(
        'Please enter a valid email address',
      );
      expect(onAdd).not.toHaveBeenCalled();
    });

    it('shows error for invalid phone', () => {
      const onAdd = jest.fn();
      render(<ChannelsOnFile channels={{ email: 'test@example.com' }} onAddIdentifier={onAdd} />);
      fireEvent.click(screen.getByTestId('add-phone-button'));
      const input = screen.getByTestId('add-phone-input');
      fireEvent.change(input, { target: { value: '12345' } });
      fireEvent.click(screen.getByText('Save'));
      expect(screen.getByTestId('add-identifier-error')).toHaveTextContent(
        'Please enter a valid phone number',
      );
      expect(onAdd).not.toHaveBeenCalled();
    });

    it('clears error when input changes', () => {
      const onAdd = jest.fn();
      render(<ChannelsOnFile channels={{ phone: '+1234567890' }} onAddIdentifier={onAdd} />);
      fireEvent.click(screen.getByTestId('add-email-button'));
      const input = screen.getByTestId('add-email-input');
      fireEvent.change(input, { target: { value: 'bad' } });
      fireEvent.click(screen.getByText('Save'));
      expect(screen.getByTestId('add-identifier-error')).toBeInTheDocument();
      fireEvent.change(input, { target: { value: 'bad2' } });
      expect(screen.queryByTestId('add-identifier-error')).not.toBeInTheDocument();
    });

    it('accepts valid email and calls onAddIdentifier', () => {
      const onAdd = jest.fn();
      render(<ChannelsOnFile channels={{ phone: '+1234567890' }} onAddIdentifier={onAdd} />);
      fireEvent.click(screen.getByTestId('add-email-button'));
      const input = screen.getByTestId('add-email-input');
      fireEvent.change(input, { target: { value: 'valid@example.com' } });
      fireEvent.click(screen.getByText('Save'));
      expect(screen.queryByTestId('add-identifier-error')).not.toBeInTheDocument();
      expect(onAdd).toHaveBeenCalledWith('email', 'valid@example.com');
    });

    it('does not call onAddIdentifier when input is empty', () => {
      const onAdd = jest.fn();
      render(<ChannelsOnFile channels={{ phone: '+1234567890' }} onAddIdentifier={onAdd} />);
      fireEvent.click(screen.getByTestId('add-email-button'));
      fireEvent.click(screen.getByText('Save'));
      expect(onAdd).not.toHaveBeenCalled();
    });
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { OutboundCompose } from './outbound-compose';

describe('OutboundCompose', () => {
  const onSend = jest.fn();
  const onClose = jest.fn();

  beforeEach(() => {
    onSend.mockClear();
    onClose.mockClear();
  });

  it('renders compose modal', () => {
    render(
      <OutboundCompose customerId="cust1" customerName="Emma" onSend={onSend} onClose={onClose} />,
    );

    expect(screen.getByTestId('outbound-compose')).toBeInTheDocument();
    expect(screen.getByText('New Message to Emma')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    render(<OutboundCompose customerId="cust1" onSend={onSend} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('close-compose'));
    expect(onClose).toHaveBeenCalled();
  });

  it('sends draft with content', () => {
    render(<OutboundCompose customerId="cust1" onSend={onSend} onClose={onClose} />);

    fireEvent.change(screen.getByTestId('compose-textarea'), {
      target: { value: 'Hello Emma!' },
    });
    fireEvent.click(screen.getByTestId('send-draft'));

    expect(onSend).toHaveBeenCalledWith({
      customerId: 'cust1',
      content: 'Hello Emma!',
    });
  });

  it('disables send when content is empty', () => {
    render(<OutboundCompose customerId="cust1" onSend={onSend} onClose={onClose} />);

    const sendBtn = screen.getByTestId('send-draft');
    expect(sendBtn).toBeDisabled();
  });

  it('disables send when loading', () => {
    render(<OutboundCompose customerId="cust1" onSend={onSend} onClose={onClose} loading />);

    fireEvent.change(screen.getByTestId('compose-textarea'), {
      target: { value: 'Hello!' },
    });
    expect(screen.getByTestId('send-draft')).toBeDisabled();
  });

  it('does not send when no customerId', () => {
    render(<OutboundCompose onSend={onSend} onClose={onClose} />);

    fireEvent.change(screen.getByTestId('compose-textarea'), {
      target: { value: 'Hello!' },
    });
    fireEvent.click(screen.getByTestId('send-draft'));

    expect(onSend).not.toHaveBeenCalled();
  });
});

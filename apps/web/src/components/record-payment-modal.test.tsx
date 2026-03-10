import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    post: (...args: any[]) => mockPost(...args),
  },
}));

const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock(
  'lucide-react',
  () =>
    new Proxy(
      {},
      {
        get: (_, name) => {
          if (name === '__esModule') return true;
          return (props: any) => <span data-icon={name as string} {...props} />;
        },
      },
    ),
);

import RecordPaymentModal from './record-payment-modal';

describe('RecordPaymentModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({});
  });

  it('renders nothing when not open', () => {
    render(<RecordPaymentModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Record Payment')).not.toBeInTheDocument();
  });

  it('renders form when open', () => {
    render(<RecordPaymentModal {...defaultProps} />);
    expect(screen.getByText('Record Payment', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Method')).toBeInTheDocument();
  });

  it('shows booking context when provided', () => {
    render(
      <RecordPaymentModal
        {...defaultProps}
        customerName="Jane Doe"
        serviceName="Facial"
        servicePrice={150}
      />,
    );
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(/Facial/)).toBeInTheDocument();
    expect(screen.getByText(/\$150/)).toBeInTheDocument();
  });

  it('submits payment via API', async () => {
    render(<RecordPaymentModal {...defaultProps} bookingId="b1" customerId="c1" />);

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '75' } });

    const submitBtn = screen.getByRole('button', { name: 'Record Payment' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/payments',
        expect.objectContaining({
          amount: 75,
          method: 'CASH',
          bookingId: 'b1',
          customerId: 'c1',
        }),
      );
    });
  });

  it('calls onSuccess and onClose after successful submit', async () => {
    render(<RecordPaymentModal {...defaultProps} />);

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '50' } });

    const submitBtn = screen.getByRole('button', { name: 'Record Payment' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('shows error toast on API failure', async () => {
    mockPost.mockRejectedValue(new Error('Server error'));

    render(<RecordPaymentModal {...defaultProps} />);

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '50' } });

    const submitBtn = screen.getByRole('button', { name: 'Record Payment' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Server error', 'error');
    });
  });

  it('closes modal when Cancel is clicked', () => {
    render(<RecordPaymentModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes modal when backdrop is clicked', () => {
    render(<RecordPaymentModal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    // The backdrop is the first child div of the dialog
    const backdrop = dialog.querySelector('.animate-backdrop');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('has Cash as default payment method', () => {
    render(<RecordPaymentModal {...defaultProps} />);
    const select = screen.getByDisplayValue('Cash');
    expect(select).toBeInTheDocument();
  });

  it('pre-fills amount from servicePrice', () => {
    render(<RecordPaymentModal {...defaultProps} servicePrice={200} />);
    const amountInput = screen.getByPlaceholderText('0.00') as HTMLInputElement;
    expect(amountInput.value).toBe('200');
  });

  it('shows invalid amount toast when amount is empty', async () => {
    render(<RecordPaymentModal {...defaultProps} />);

    // The submit button is disabled when amount is empty, so submit via form
    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('payment.invalid_amount', 'error');
    });
  });

  it('does not call onSuccess or onClose on API failure', async () => {
    mockPost.mockRejectedValue(new Error('fail'));

    render(<RecordPaymentModal {...defaultProps} />);

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '50' } });

    const submitBtn = screen.getByRole('button', { name: 'Record Payment' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('fail', 'error');
    });

    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('shows close button with aria-label', () => {
    render(<RecordPaymentModal {...defaultProps} />);
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('closes modal when X button is clicked', () => {
    render(<RecordPaymentModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});

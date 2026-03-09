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

import RefundModal from './refund-modal';

describe('RefundModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
    payment: {
      id: 'pay1',
      amount: 100,
      method: 'CASH',
      refundedAmount: 0,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({});
  });

  it('renders nothing when not open', () => {
    render(<RefundModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Issue Refund')).not.toBeInTheDocument();
  });

  it('renders form when open', () => {
    render(<RefundModal {...defaultProps} />);
    expect(screen.getByText('Issue Refund', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText('Refund Amount')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Why is this refund being issued?')).toBeInTheDocument();
  });

  it('shows payment details', () => {
    render(<RefundModal {...defaultProps} />);
    expect(screen.getByText('Original payment')).toBeInTheDocument();
    expect(screen.getAllByText('$100.00')).toHaveLength(2); // original + refundable
    expect(screen.getByText('CASH')).toBeInTheDocument();
    expect(screen.getByText('Refundable')).toBeInTheDocument();
  });

  it('shows already refunded amount when partial', () => {
    render(
      <RefundModal
        {...defaultProps}
        payment={{ id: 'pay1', amount: 100, method: 'CASH', refundedAmount: 30 }}
      />,
    );
    expect(screen.getByText('Already refunded')).toBeInTheDocument();
    expect(screen.getByText('$30.00')).toBeInTheDocument();
  });

  it('pre-fills amount with max refundable', () => {
    render(<RefundModal {...defaultProps} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('100.00');
  });

  it('validates amount exceeds refundable', () => {
    render(<RefundModal {...defaultProps} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '150' } });
    expect(screen.getByText('Amount exceeds refundable balance')).toBeInTheDocument();
  });

  it('shows confirmation step on Continue', () => {
    render(<RefundModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByText('Confirm Refund')).toBeInTheDocument();
  });

  it('shows refund amount in confirmation', () => {
    render(<RefundModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByText('$100.00', { selector: 'span' })).toBeInTheDocument();
  });

  it('can go back from confirmation to form', () => {
    render(<RefundModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByText('Confirm Refund')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Go Back'));
    expect(screen.getByText('Issue Refund')).toBeInTheDocument();
  });

  it('submits refund via API', async () => {
    render(<RefundModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(screen.getByText('Process Refund'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/refunds', {
        paymentId: 'pay1',
        amount: 100,
        reason: undefined,
      });
    });
  });

  it('calls onSuccess and onClose on successful submit', async () => {
    render(<RefundModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(screen.getByText('Process Refund'));

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('shows error toast on API failure', async () => {
    mockPost.mockRejectedValue(new Error('Server error'));

    render(<RefundModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(screen.getByText('Process Refund'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Server error', 'error');
    });
  });

  it('closes modal on Cancel', () => {
    render(<RefundModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows undone warning in confirmation', () => {
    render(<RefundModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });
});

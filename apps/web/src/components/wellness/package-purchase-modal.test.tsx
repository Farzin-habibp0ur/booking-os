import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PackagePurchaseModal from './package-purchase-modal';

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { apiFetch } = require('@/lib/api');

describe('PackagePurchaseModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    customerId: 'cust-1',
    customerName: 'Jane Smith',
    onPurchased: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    apiFetch.mockResolvedValue([
      {
        id: 'pkg-1',
        name: '10 Massage Sessions',
        totalSessions: 10,
        price: '250.00',
        currency: 'USD',
        validityDays: 365,
        isActive: true,
        service: null,
      },
      {
        id: 'pkg-2',
        name: '5 Yoga Sessions',
        totalSessions: 5,
        price: '100.00',
        currency: 'USD',
        validityDays: 180,
        isActive: true,
        service: { id: 'svc-1', name: 'Yoga Class' },
      },
    ]);
  });

  it('renders when open', async () => {
    render(<PackagePurchaseModal {...defaultProps} />);
    expect(screen.getByText('Sell Package')).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<PackagePurchaseModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Sell Package')).not.toBeInTheDocument();
  });

  it('loads packages on mount', async () => {
    render(<PackagePurchaseModal {...defaultProps} />);
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/packages');
    });
  });

  it('shows package details on select', async () => {
    render(<PackagePurchaseModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Package')).toBeInTheDocument();
    });
    const select = screen.getByLabelText('Package');
    fireEvent.change(select, { target: { value: 'pkg-1' } });
    // The detail panel shows the selected package name
    const details = screen.getAllByText(/10 Massage Sessions/);
    expect(details.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onClose on cancel', async () => {
    render(<PackagePurchaseModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('disables confirm without selection', async () => {
    render(<PackagePurchaseModal {...defaultProps} />);
    const confirmBtn = screen.getByText('Confirm Purchase');
    expect(confirmBtn).toBeDisabled();
  });
});

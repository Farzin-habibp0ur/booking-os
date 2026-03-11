import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoiceDetailPage from './page';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'inv1' }),
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
  },
}));

jest.mock('@/components/skeleton', () => ({
  DetailSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}));

const mockInvoice = {
  id: 'inv1',
  invoiceNumber: 'INV-2026-0001',
  status: 'SENT',
  subtotal: 150,
  taxRate: 0.08,
  taxAmount: 12,
  discountAmount: 0,
  total: 162,
  paidAmount: 0,
  currency: 'USD',
  dueDate: '2026-04-10T00:00:00Z',
  notes: 'Please pay promptly',
  terms: 'Net 30',
  sentAt: '2026-03-10T00:00:00Z',
  viewedAt: null,
  paidAt: null,
  createdAt: '2026-03-10T00:00:00Z',
  customer: { id: 'c1', name: 'John Doe', email: 'john@test.com', phone: '+1234567890' },
  booking: null,
  lineItems: [
    { id: 'li1', description: 'Consultation', quantity: 1, unitPrice: 100, total: 100, service: null },
    { id: 'li2', description: 'Follow-up', quantity: 1, unitPrice: 50, total: 50, service: null },
  ],
  payments: [],
  business: { name: 'Test Clinic', logoUrl: null, phone: null },
};

describe('InvoiceDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue(mockInvoice);
    mockPost.mockResolvedValue({});
  });

  it('renders invoice detail', async () => {
    render(<InvoiceDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
      expect(screen.getAllByText('John Doe').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Sent').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays line items', async () => {
    render(<InvoiceDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Consultation')).toBeInTheDocument();
      expect(screen.getByText('Follow-up')).toBeInTheDocument();
    });
  });

  it('displays totals breakdown', async () => {
    render(<InvoiceDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('$150.00')).toBeInTheDocument(); // subtotal
      expect(screen.getByText('$162.00')).toBeInTheDocument(); // total
    });
  });

  it('shows record payment button for sent invoices', async () => {
    render(<InvoiceDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Record Payment')).toBeInTheDocument();
    });
  });

  it('opens payment modal', async () => {
    render(<InvoiceDetailPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getAllByText('Record Payment').length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getAllByText('Record Payment')[0]);
    expect(screen.getByLabelText('Payment method')).toBeInTheDocument();
  });

  it('shows notes and terms', async () => {
    render(<InvoiceDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Please pay promptly')).toBeInTheDocument();
      expect(screen.getByText('Net 30')).toBeInTheDocument();
    });
  });

  it('shows cancel button for non-paid invoices', async () => {
    render(<InvoiceDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('renders draft invoice with send button', async () => {
    mockGet.mockResolvedValue({ ...mockInvoice, status: 'DRAFT' });

    render(<InvoiceDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Send Invoice')).toBeInTheDocument();
    });
  });

  it('shows payment history when payments exist', async () => {
    mockGet.mockResolvedValue({
      ...mockInvoice,
      status: 'PARTIALLY_PAID',
      paidAmount: 50,
      payments: [
        { id: 'p1', amount: 50, method: 'CASH', createdAt: '2026-03-11T00:00:00Z', reference: 'RCP-001' },
      ],
    });

    render(<InvoiceDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment History')).toBeInTheDocument();
      expect(screen.getByText('$50.00 via CASH')).toBeInTheDocument();
      expect(screen.getByText('Ref: RCP-001')).toBeInTheDocument();
    });
  });
});

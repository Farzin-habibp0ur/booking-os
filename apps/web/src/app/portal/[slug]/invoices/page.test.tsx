import { render, screen, waitFor } from '@testing-library/react';
import PortalInvoicesPage from './page';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useParams: () => ({ slug: 'test-clinic' }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/components/skeleton', () => ({
  ListSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}));

const mockInvoices = [
  {
    id: 'inv1',
    invoiceNumber: 'INV-2026-0001',
    status: 'SENT',
    total: 100,
    paidAmount: 0,
    dueDate: '2026-04-10T00:00:00Z',
    createdAt: '2026-03-10T00:00:00Z',
    lineItems: [{ description: 'Consultation', quantity: 1, total: 100 }],
  },
  {
    id: 'inv2',
    invoiceNumber: 'INV-2026-0002',
    status: 'PAID',
    total: 50,
    paidAmount: 50,
    dueDate: '2026-03-15T00:00:00Z',
    createdAt: '2026-02-15T00:00:00Z',
    lineItems: [{ description: 'Follow-up', quantity: 1, total: 50 }],
  },
];

describe('PortalInvoicesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.setItem('portal-token', 'test-token');

    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve(mockInvoices),
    });
  });

  afterEach(() => {
    sessionStorage.removeItem('portal-token');
  });

  it('renders invoices list', async () => {
    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('INV-2026-0002')).toBeInTheDocument();
    });
  });

  it('shows outstanding summary for unpaid invoices', async () => {
    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('$100.00 outstanding')).toBeInTheDocument();
    });
  });

  it('displays line item descriptions', async () => {
    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('Consultation')).toBeInTheDocument();
      expect(screen.getByText('Follow-up')).toBeInTheDocument();
    });
  });

  it('shows empty state when no invoices', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve([]),
    });

    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('No invoices yet')).toBeInTheDocument();
    });
  });

  it('redirects to portal login if no token', () => {
    sessionStorage.removeItem('portal-token');
    render(<PortalInvoicesPage />);
    expect(mockReplace).toHaveBeenCalledWith('/portal/test-clinic');
  });
});

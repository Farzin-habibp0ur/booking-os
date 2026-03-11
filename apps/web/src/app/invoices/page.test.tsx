import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoicesPage from './page';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { get: (...args: any[]) => mockGet(...args) },
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

jest.mock('@/components/skeleton', () => ({
  ListSkeleton: () => <div data-testid="skeleton">Loading...</div>,
  EmptyState: ({ title }: any) => <div data-testid="empty-state">{title}</div>,
}));

const mockInvoices = [
  {
    id: 'inv1',
    invoiceNumber: 'INV-2026-0001',
    status: 'DRAFT',
    total: 100,
    paidAmount: 0,
    currency: 'USD',
    dueDate: '2026-04-10T00:00:00Z',
    createdAt: '2026-03-10T00:00:00Z',
    customer: { id: 'c1', name: 'John Doe', email: 'john@test.com' },
  },
  {
    id: 'inv2',
    invoiceNumber: 'INV-2026-0002',
    status: 'PAID',
    total: 250,
    paidAmount: 250,
    currency: 'USD',
    dueDate: '2026-03-15T00:00:00Z',
    createdAt: '2026-02-15T00:00:00Z',
    customer: { id: 'c2', name: 'Jane Smith', email: 'jane@test.com' },
  },
];

const mockStats = {
  totalOutstanding: 100,
  outstandingCount: 1,
  overdueAmount: 0,
  overdueCount: 0,
  revenueThisMonth: 250,
  paidThisMonthCount: 1,
  avgDaysToPay: 5,
};

describe('InvoicesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/invoices/stats')) return Promise.resolve(mockStats);
      return Promise.resolve({ data: mockInvoices, total: 2 });
    });
  });

  it('renders invoice list', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('INV-2026-0002')).toBeInTheDocument();
    });
  });

  it('displays stats bar', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('Outstanding')).toBeInTheDocument();
      expect(screen.getByText('1 invoices')).toBeInTheDocument();
      expect(screen.getByText('1 paid')).toBeInTheDocument();
    });
  });

  it('shows customer names', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('displays status badges', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.getByText('Paid')).toBeInTheDocument();
    });
  });

  it('navigates to new invoice page on button click', async () => {
    render(<InvoicesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('New Invoice')).toBeInTheDocument();
    });

    await user.click(screen.getByText('New Invoice'));
    expect(mockPush).toHaveBeenCalledWith('/invoices/new');
  });

  it('navigates to invoice detail on row click', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('INV-2026-0001'));
    expect(mockPush).toHaveBeenCalledWith('/invoices/inv1');
  });

  it('shows empty state when no invoices', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/invoices/stats')) return Promise.resolve(mockStats);
      return Promise.resolve({ data: [], total: 0 });
    });

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('filters invoices by status tab', async () => {
    render(<InvoicesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Overdue' }));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('status=OVERDUE'));
  });

  it('filters by search input', async () => {
    render(<InvoicesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search invoices...');
    await user.type(searchInput, 'Jane');

    expect(screen.queryByText('INV-2026-0001')).not.toBeInTheDocument();
    expect(screen.getByText('INV-2026-0002')).toBeInTheDocument();
  });
});

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
  ListSkeleton: ({ rows }: any) => <div data-testid="list-skeleton">Loading {rows} rows</div>,
}));

jest.mock('@/lib/design-tokens', () => ({
  INVOICE_STATUS_STYLES: {
    DRAFT: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Draft' },
    SENT: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Sent' },
    VIEWED: { bg: 'bg-lavender-50', text: 'text-lavender-900', label: 'Viewed' },
    PAID: { bg: 'bg-sage-50', text: 'text-sage-700', label: 'Paid' },
    PARTIALLY_PAID: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Partially Paid' },
    OVERDUE: { bg: 'bg-red-50', text: 'text-red-700', label: 'Overdue' },
    VOID: { bg: 'bg-slate-50', text: 'text-slate-500', label: 'Void' },
    REFUNDED: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Refunded' },
  },
  invoiceBadgeClasses: (status: string) => `badge-${status.toLowerCase()}`,
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PortalInvoicesPage from './page';

const mockInvoices = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-0001',
    status: 'SENT',
    total: 150,
    paidAmount: 0,
    dueDate: '2026-04-10T00:00:00Z',
    createdAt: '2026-03-10T00:00:00Z',
    lineItems: [
      { description: 'Deep Tissue Massage', quantity: 1, unitPrice: 120, total: 120 },
      { description: 'Add-on: Hot Stones', quantity: 1, unitPrice: 30, total: 30 },
    ],
  },
  {
    id: 'inv-2',
    invoiceNumber: 'INV-2026-0002',
    status: 'PAID',
    total: 85,
    paidAmount: 85,
    dueDate: '2026-03-15T00:00:00Z',
    createdAt: '2026-02-15T00:00:00Z',
    lineItems: [{ description: 'Facial Treatment', quantity: 1, unitPrice: 85, total: 85 }],
  },
  {
    id: 'inv-3',
    invoiceNumber: 'INV-2026-0003',
    status: 'PARTIALLY_PAID',
    total: 200,
    paidAmount: 50,
    dueDate: '2026-04-20T00:00:00Z',
    createdAt: '2026-03-05T00:00:00Z',
    lineItems: [
      { description: 'Consultation', quantity: 1, unitPrice: 50, total: 50 },
      { description: 'Treatment Plan', quantity: 1, unitPrice: 100, total: 100 },
      { description: 'Follow-up Visit', quantity: 1, unitPrice: 50, total: 50 },
    ],
  },
];

describe('PortalInvoicesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.setItem('portal-token', 'test-token');

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === 'POST') {
        return Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve({ url: 'https://checkout.stripe.com/test-session' }),
        });
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockInvoices),
      });
    });
  });

  afterEach(() => {
    sessionStorage.removeItem('portal-token');
  });

  // -------------------------------------------------------------------------
  // Auth redirect
  // -------------------------------------------------------------------------

  it('redirects to portal login when no token in sessionStorage', () => {
    sessionStorage.removeItem('portal-token');
    render(<PortalInvoicesPage />);
    expect(mockReplace).toHaveBeenCalledWith('/portal/test-clinic');
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('shows list skeleton while loading', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));
    render(<PortalInvoicesPage />);
    expect(screen.getByTestId('list-skeleton')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Page title
  // -------------------------------------------------------------------------

  it('renders the page title', async () => {
    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('My Invoices')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Invoice list display
  // -------------------------------------------------------------------------

  it('renders all invoice numbers', async () => {
    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('INV-2026-0002')).toBeInTheDocument();
      expect(screen.getByText('INV-2026-0003')).toBeInTheDocument();
    });
  });

  it('displays invoice totals', async () => {
    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('$150.00')).toBeInTheDocument();
      expect(screen.getByText('$85.00')).toBeInTheDocument();
      expect(screen.getByText('$200.00')).toBeInTheDocument();
    });
  });

  it('shows line item descriptions', async () => {
    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
      expect(screen.getByText('Add-on: Hot Stones')).toBeInTheDocument();
      expect(screen.getByText('Facial Treatment')).toBeInTheDocument();
    });
  });

  it('truncates line items to 2 and shows "+N more items"', async () => {
    render(<PortalInvoicesPage />);

    // inv-3 has 3 line items, should show first 2 and "+1 more items"
    await waitFor(() => {
      expect(screen.getByText('Consultation')).toBeInTheDocument();
      expect(screen.getByText('Treatment Plan')).toBeInTheDocument();
    });
    expect(screen.getByText('+1 more items')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Status badges
  // -------------------------------------------------------------------------

  it('displays status badge labels from design tokens', async () => {
    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('Sent')).toBeInTheDocument();
      expect(screen.getByText('Paid')).toBeInTheDocument();
      expect(screen.getByText('Partially Paid')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Partial payment indicator
  // -------------------------------------------------------------------------

  it('shows paid amount for partially paid invoices', async () => {
    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('$50.00 paid')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Outstanding summary
  // -------------------------------------------------------------------------

  it('shows outstanding summary for payable invoices', async () => {
    render(<PortalInvoicesPage />);

    // inv-1 ($150 - $0 = $150) + inv-3 ($200 - $50 = $150) = $300 outstanding
    await waitFor(() => {
      expect(screen.getByText('$300.00 outstanding')).toBeInTheDocument();
    });

    expect(screen.getByText('2 invoices pending payment')).toBeInTheDocument();
  });

  it('does not show outstanding summary when all invoices are paid', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 'inv-paid',
            invoiceNumber: 'INV-PAID',
            status: 'PAID',
            total: 100,
            paidAmount: 100,
            dueDate: '2026-03-01T00:00:00Z',
            createdAt: '2026-02-01T00:00:00Z',
            lineItems: [{ description: 'Service', quantity: 1, unitPrice: 100, total: 100 }],
          },
        ]),
    });

    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-PAID')).toBeInTheDocument();
    });

    expect(screen.queryByText(/outstanding/)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Pay Now button
  // -------------------------------------------------------------------------

  it('shows Pay Now button for payable invoices only', async () => {
    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    });

    // SENT and PARTIALLY_PAID should have Pay buttons; PAID should not
    const payButtons = screen.getAllByTestId('pay-now-btn');
    expect(payButtons).toHaveLength(2);

    // Both payable invoices have $150 balance, so there should be two matching buttons
    expect(screen.getAllByText('Pay $150.00')).toHaveLength(2);
  });

  it('calls portalPost and redirects on Pay Now click', async () => {
    // Mock window.location
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '', origin: 'http://localhost:3000' },
    });

    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    });

    const payButtons = screen.getAllByTestId('pay-now-btn');
    fireEvent.click(payButtons[0]);

    await waitFor(() => {
      // Verify the POST was made
      const postCall = (global.fetch as jest.Mock).mock.calls.find(
        (call: any[]) => call[1]?.method === 'POST',
      );
      expect(postCall).toBeTruthy();
      expect(postCall[0]).toContain('/portal/invoices/inv-1/pay');

      const body = JSON.parse(postCall[1].body);
      expect(body.successUrl).toContain('/portal/test-clinic/invoices?paid=true');
      expect(body.cancelUrl).toContain('/portal/test-clinic/invoices');
    });

    // Should redirect to Stripe checkout
    await waitFor(() => {
      expect(window.location.href).toBe('https://checkout.stripe.com/test-session');
    });

    // Restore
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('shows error message when payment fails', async () => {
    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === 'POST') {
        return Promise.resolve({
          status: 400,
          ok: false,
          json: () => Promise.resolve({ message: 'Payment method required' }),
        });
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockInvoices),
      });
    });

    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    });

    const payButtons = screen.getAllByTestId('pay-now-btn');
    fireEvent.click(payButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Payment method required')).toBeInTheDocument();
    });
  });

  it('shows Processing... state while payment is in progress', async () => {
    // Make the POST never resolve to keep the loading state
    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === 'POST') {
        return new Promise(() => {}); // never resolves
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve(mockInvoices),
      });
    });

    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    });

    const payButtons = screen.getAllByTestId('pay-now-btn');
    fireEvent.click(payButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Download PDF button
  // -------------------------------------------------------------------------

  it('shows Download PDF button on every invoice', async () => {
    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByTestId('download-pdf-btn');
    expect(downloadButtons).toHaveLength(3); // one per invoice
  });

  it('opens new window with invoice HTML on Download PDF click', async () => {
    const mockWrite = jest.fn();
    const mockClose = jest.fn();
    const mockWindowOpen = jest.fn().mockReturnValue({
      document: { write: mockWrite, close: mockClose },
    });
    window.open = mockWindowOpen;

    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByTestId('download-pdf-btn');
    fireEvent.click(downloadButtons[0]);

    expect(mockWindowOpen).toHaveBeenCalledWith('', '_blank');
    expect(mockWrite).toHaveBeenCalledTimes(1);
    // Verify the HTML contains the invoice number
    const writtenHtml = mockWrite.mock.calls[0][0];
    expect(writtenHtml).toContain('INV-2026-0001');
    expect(writtenHtml).toContain('Deep Tissue Massage');
    expect(writtenHtml).toContain('$150.00');
    expect(mockClose).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it('shows empty state when no invoices exist', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('No invoices yet')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Fetch with auth header
  // -------------------------------------------------------------------------

  it('sends Authorization header with portal token', async () => {
    render(<PortalInvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    });

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(fetchCall[1].headers.Authorization).toBe('Bearer test-token');
  });
});

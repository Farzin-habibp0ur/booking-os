const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'biz1' }),
  usePathname: () => '/console/businesses/biz1',
}));
jest.mock('next/link', () => {
  const Link = ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  return Link;
});
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'admin1', role: 'SUPER_ADMIN', email: 'admin@businesscommandcentre.com' },
    loading: false,
  }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

jest.mock('lucide-react', () => {
  const icons = [
    'ChevronRight',
    'Globe',
    'Calendar',
    'Users',
    'MessageSquare',
    'ClipboardList',
    'Megaphone',
    'Bot',
    'Eye',
    'CreditCard',
    'X',
    'AlertTriangle',
    'DollarSign',
    'FileText',
    'RefreshCw',
  ];
  const mocks: Record<string, any> = {};
  icons.forEach((name) => {
    mocks[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />;
  });
  return mocks;
});

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Business360Page from './page';

const mockBusiness = {
  id: 'biz1',
  name: 'Glow Aesthetic Clinic',
  slug: 'glow-clinic',
  timezone: 'America/New_York',
  verticalPack: 'aesthetics',
  packConfig: {},
  defaultLocale: 'en',
  createdAt: '2025-01-15T00:00:00Z',
  owner: { email: 'sarah@glow.com', name: 'Sarah' },
  subscription: {
    plan: 'pro',
    status: 'active',
    currentPeriodEnd: '2026-03-15T00:00:00Z',
  },
  health: 'green',
  lastActive: new Date().toISOString(),
  counts: {
    bookings: 150,
    customers: 42,
    conversations: 30,
    staff: 4,
    services: 8,
    campaigns: 3,
    waitlistEntries: 2,
  },
};

const mockUsage = {
  bookings7d: 12,
  bookings30d: 47,
  conversations: 30,
  waitlistEntries: 2,
  campaigns: 3,
  agentRuns: 7,
};

const mockStaff = [
  {
    id: 's1',
    name: 'Sarah Chen',
    email: 'sarah@glow.com',
    role: 'ADMIN',
    isActive: true,
    createdAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 's2',
    name: 'Dr. Kim',
    email: 'kim@glow.com',
    role: 'SERVICE_PROVIDER',
    isActive: true,
    createdAt: '2025-02-01T00:00:00Z',
  },
  {
    id: 's3',
    name: 'Alex',
    email: 'alex@glow.com',
    role: 'AGENT',
    isActive: false,
    createdAt: '2025-03-01T00:00:00Z',
  },
];

const mockBillingData = {
  subscription: {
    id: 'sub1',
    plan: 'pro',
    status: 'active',
    currentPeriodEnd: '2026-03-15T00:00:00Z',
    stripeSubscriptionId: 'sub_stripe123',
    canceledAt: null,
    cancelReason: null,
    planChangedAt: null,
  },
  credits: [],
  recentInvoices: [],
};

const mockCredits = [
  {
    id: 'c1',
    amount: 50,
    reason: 'Goodwill',
    expiresAt: null,
    appliedAt: '2026-02-01T00:00:00Z',
    stripeId: 'txn_1',
    createdAt: '2026-02-01T00:00:00Z',
    issuedBy: { name: 'Admin', email: 'admin@test.com' },
  },
];

const mockInvoices = [
  {
    id: 'inv_1',
    amount: 149,
    status: 'paid',
    date: '2026-02-01T00:00:00Z',
    pdfUrl: 'https://stripe.com/invoice.pdf',
  },
];

async function renderAndWait() {
  await act(async () => {
    render(<Business360Page />);
  });
  await waitFor(() => {
    expect(screen.getByText('Business Details')).toBeInTheDocument();
  });
}

describe('Business360Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/usage')) return Promise.resolve(mockUsage);
      if (url.includes('/staff')) return Promise.resolve(mockStaff);
      if (url.includes('/billing/credits')) return Promise.resolve(mockCredits);
      if (url.includes('/billing/invoices')) return Promise.resolve(mockInvoices);
      if (url.includes('/billing')) return Promise.resolve(mockBillingData);
      return Promise.resolve(mockBusiness);
    });
  });

  it('shows loading state', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));

    render(<Business360Page />);

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders summary tab with business details', async () => {
    await renderAndWait();

    expect(screen.getByText('glow-clinic')).toBeInTheDocument();
    expect(screen.getByText('America/New_York')).toBeInTheDocument();
    expect(screen.getByText('aesthetics')).toBeInTheDocument();
    expect(screen.getAllByText('Glow Aesthetic Clinic').length).toBeGreaterThanOrEqual(1);
  });

  it('renders usage snapshot', async () => {
    await renderAndWait();

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Bookings (7d)')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('Bookings (30d)')).toBeInTheDocument();
  });

  it('displays health status', async () => {
    await renderAndWait();

    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('displays total counts', async () => {
    await renderAndWait();

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
  });

  it('has breadcrumb navigation', async () => {
    await renderAndWait();

    const breadcrumbLink = screen.getByText('Businesses').closest('a');
    expect(breadcrumbLink).toHaveAttribute('href', '/console/businesses');
  });

  it('has view-as button', async () => {
    await renderAndWait();

    expect(screen.getByTestId('view-as-button')).toBeInTheDocument();
    expect(screen.getByText('View as this business')).toBeInTheDocument();
  });

  it('switches to People tab and shows staff list', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-people'));
    });

    await waitFor(() => {
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    });

    expect(screen.getByText('Dr. Kim')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('sarah@glow.com')).toBeInTheDocument();
  });

  it('shows staff roles and status', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-people'));
    });

    await waitFor(() => {
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
    });

    expect(screen.getByText('SERVICE_PROVIDER')).toBeInTheDocument();
    expect(screen.getByText('AGENT')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    mockApi.get.mockRejectedValue(new Error('Server error'));

    await act(async () => {
      render(<Business360Page />);
    });

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  // ─── Billing Tab Tests ──────────────────────────────────

  it('renders Billing tab', async () => {
    await renderAndWait();

    expect(screen.getByTestId('tab-billing')).toBeInTheDocument();
  });

  it('shows subscription info when clicking Billing tab', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-billing'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('subscription-info')).toBeInTheDocument();
    });

    expect(screen.getByText('sub_stripe123')).toBeInTheDocument();
  });

  it('shows no subscription state', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/usage')) return Promise.resolve(mockUsage);
      if (url.includes('/billing/credits')) return Promise.resolve([]);
      if (url.includes('/billing/invoices')) return Promise.resolve([]);
      if (url.includes('/billing'))
        return Promise.resolve({ subscription: null, credits: [], recentInvoices: [] });
      return Promise.resolve(mockBusiness);
    });

    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-billing'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('no-subscription')).toBeInTheDocument();
    });
  });

  it('opens change plan modal', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-billing'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('change-plan-btn')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('change-plan-btn'));
    });

    expect(screen.getByTestId('change-plan-modal')).toBeInTheDocument();
  });

  it('submits change plan form', async () => {
    const user = userEvent.setup();
    mockApi.post.mockResolvedValue({ id: 'sub1', plan: 'basic' });

    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-billing'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('change-plan-btn')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('change-plan-btn'));
    });

    await act(async () => {
      await user.type(screen.getByTestId('reason-input'), 'Customer requested downgrade');
      await user.click(screen.getByTestId('confirm-change-plan'));
    });

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/admin/businesses/biz1/billing/change-plan', {
        newPlan: 'basic',
        reason: 'Customer requested downgrade',
      });
    });
  });

  it('opens issue credit modal', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-billing'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('issue-credit-btn')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('issue-credit-btn'));
    });

    expect(screen.getByTestId('credit-modal')).toBeInTheDocument();
  });

  it('submits credit form', async () => {
    const user = userEvent.setup();
    mockApi.post.mockResolvedValue({ id: 'c1', amount: 50 });

    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-billing'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('issue-credit-btn')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('issue-credit-btn'));
    });

    await act(async () => {
      await user.type(screen.getByTestId('credit-amount'), '50');
      await user.type(screen.getByTestId('credit-reason'), 'Service disruption');
      await user.click(screen.getByTestId('confirm-credit'));
    });

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/admin/businesses/biz1/billing/credit', {
        amount: 50,
        reason: 'Service disruption',
      });
    });
  });

  it('opens cancel modal with reason and confirmation', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-billing'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('cancel-btn'));
    });

    expect(screen.getByTestId('cancel-modal')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-reason')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-confirmation')).toBeInTheDocument();
  });

  it('shows reactivate button for canceled subscription', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/usage')) return Promise.resolve(mockUsage);
      if (url.includes('/billing/credits')) return Promise.resolve([]);
      if (url.includes('/billing/invoices')) return Promise.resolve([]);
      if (url.includes('/billing'))
        return Promise.resolve({
          ...mockBillingData,
          subscription: {
            ...mockBillingData.subscription,
            status: 'canceled',
            canceledAt: '2026-02-10T00:00:00Z',
            cancelReason: 'Non-payment',
          },
        });
      return Promise.resolve(mockBusiness);
    });

    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-billing'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('reactivate-btn')).toBeInTheDocument();
    });

    // Should not show change plan or cancel buttons
    expect(screen.queryByTestId('change-plan-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel-btn')).not.toBeInTheDocument();
  });

  it('hides reactivate button for active subscription', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-billing'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('billing-actions')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('reactivate-btn')).not.toBeInTheDocument();
  });

  it('renders credits table', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-billing'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('credits-table')).toBeInTheDocument();
      expect(screen.getByText('$50')).toBeInTheDocument();
      expect(screen.getByText('Goodwill')).toBeInTheDocument();
    });
  });

  it('renders invoice table', async () => {
    const user = userEvent.setup();
    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-billing'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('invoices-table')).toBeInTheDocument();
      expect(screen.getByText('$149')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });
  });

  it('shows billing loading state', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/usage')) return Promise.resolve(mockUsage);
      if (url.includes('/billing')) return new Promise(() => {}); // never resolves
      return Promise.resolve(mockBusiness);
    });

    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-billing'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('billing-loading')).toBeInTheDocument();
    });
  });

  it('handles failed mutation with error message', async () => {
    const user = userEvent.setup();
    mockApi.post.mockRejectedValue(new Error('Plan change failed'));

    await renderAndWait();

    await act(async () => {
      await user.click(screen.getByTestId('tab-billing'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('change-plan-btn')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('change-plan-btn'));
    });

    await act(async () => {
      await user.type(screen.getByTestId('reason-input'), 'Test');
      await user.click(screen.getByTestId('confirm-change-plan'));
    });

    await waitFor(() => {
      expect(screen.getByText('Plan change failed')).toBeInTheDocument();
    });
  });
});

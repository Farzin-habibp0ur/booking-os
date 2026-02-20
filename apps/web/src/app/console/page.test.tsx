const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/console',
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
    'Building2', 'Users', 'Calendar', 'MessageSquare', 'Bot',
    'ShieldCheck', 'LifeBuoy', 'Activity', 'Eye', 'TrendingUp', 'TrendingDown',
    'AlertTriangle', 'AlertCircle', 'Info', 'ArrowRight',
  ];
  const mocks: Record<string, any> = {};
  icons.forEach((name) => {
    mocks[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />;
  });
  return mocks;
});

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import ConsoleOverviewPage from './page';

const mockOverviewData = {
  businesses: { total: 9, withActiveSubscription: 6, trial: 2, pastDue: 1, canceled: 0 },
  bookings: { total: 500, today: 12, last7d: 85, last30d: 300 },
  platform: { totalStaff: 45, totalCustomers: 890, totalConversations: 234, totalAgentRuns: 50, agentRuns7d: 10, failedAgentRuns7d: 0 },
  support: { openCases: 3 },
  security: { activeViewAsSessions: 0 },
  recentAuditLogs: [
    {
      id: '1',
      actorEmail: 'admin@businesscommandcentre.com',
      action: 'BUSINESS_LOOKUP',
      targetType: 'BUSINESS',
      targetId: 'biz1',
      createdAt: new Date().toISOString(),
    },
  ],
  attentionItems: [],
  accountsAtRisk: [],
};

describe('ConsoleOverviewPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockResolvedValue(mockOverviewData);
  });

  it('renders loading state initially', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));

    render(<ConsoleOverviewPage />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders overview data after loading', async () => {
    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Platform Overview')).toBeInTheDocument();
    });

    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('Total Businesses')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Active Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Bookings Today')).toBeInTheDocument();
    expect(screen.getByText('890')).toBeInTheDocument();
    expect(screen.getByText('Total Customers')).toBeInTheDocument();
  });

  it('renders recent audit log entries', async () => {
    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    expect(screen.getByText('admin@businesscommandcentre.com')).toBeInTheDocument();
    expect(screen.getByText('Business lookup')).toBeInTheDocument();
    expect(screen.getByText('View all')).toBeInTheDocument();
  });

  it('renders error state when API fails', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<ConsoleOverviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to load overview data.')).toBeInTheDocument();
    });
  });

  it('links to businesses page from Total Businesses card', async () => {
    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Businesses')).toBeInTheDocument();
    });

    const link = screen.getByText('Total Businesses').closest('a');
    expect(link).toHaveAttribute('href', '/console/businesses');
  });

  // --- Attention Feed Tests ---

  it('shows "All clear" when no attention items', async () => {
    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByTestId('attention-feed')).toBeInTheDocument();
    });

    expect(screen.getByTestId('attention-empty')).toBeInTheDocument();
    expect(screen.getByText('All clear')).toBeInTheDocument();
  });

  it('renders attention items with severity badges', async () => {
    mockApi.get.mockResolvedValue({
      ...mockOverviewData,
      attentionItems: [
        {
          id: 'past-due-subs',
          severity: 'critical',
          category: 'billing',
          title: '2 past-due subscriptions (>3 days)',
          description: 'Test Clinic, Bad Clinic',
          actionLabel: 'View Billing',
          actionHref: '/console/billing',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'dormant-businesses',
          severity: 'info',
          category: 'businesses',
          title: '3 dormant businesses',
          description: 'Idle Clinic and 2 more',
          actionLabel: 'View Businesses',
          actionHref: '/console/businesses',
          timestamp: new Date().toISOString(),
        },
      ],
    });

    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByTestId('attention-feed')).toBeInTheDocument();
    });

    expect(screen.getByTestId('attention-item-critical')).toBeInTheDocument();
    expect(screen.getByTestId('attention-item-info')).toBeInTheDocument();
    expect(screen.getByText('2 past-due subscriptions (>3 days)')).toBeInTheDocument();
  });

  it('renders critical severity with red styling', async () => {
    mockApi.get.mockResolvedValue({
      ...mockOverviewData,
      attentionItems: [
        {
          id: 'past-due-subs',
          severity: 'critical',
          category: 'billing',
          title: 'Critical alert',
          description: 'Test',
          actionLabel: 'View',
          actionHref: '/console/billing',
          timestamp: new Date().toISOString(),
        },
      ],
    });

    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      const badge = screen.getByTestId('severity-badge');
      expect(badge).toHaveTextContent('critical');
    });
  });

  it('renders action buttons that link to correct pages', async () => {
    mockApi.get.mockResolvedValue({
      ...mockOverviewData,
      attentionItems: [
        {
          id: 'urgent-support',
          severity: 'warning',
          category: 'support',
          title: '1 urgent support case',
          description: 'Help needed',
          actionLabel: 'View Support',
          actionHref: '/console/support',
          timestamp: new Date().toISOString(),
        },
      ],
    });

    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      const actionLink = screen.getByTestId('attention-action');
      expect(actionLink).toHaveAttribute('href', '/console/support');
      expect(actionLink).toHaveTextContent('View Support');
    });
  });

  // --- Accounts at Risk Tests ---

  it('shows "No accounts at risk" when empty', async () => {
    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByTestId('at-risk-section')).toBeInTheDocument();
    });

    expect(screen.getByTestId('at-risk-empty')).toBeInTheDocument();
    expect(screen.getByText('No accounts at risk')).toBeInTheDocument();
  });

  it('renders at-risk table with business data', async () => {
    mockApi.get.mockResolvedValue({
      ...mockOverviewData,
      accountsAtRisk: [
        {
          businessId: 'biz1',
          businessName: 'Troubled Clinic',
          riskScore: 85,
          plan: 'basic',
          status: 'past_due',
          lastBooking: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
          topSignal: 'Billing',
        },
        {
          businessId: 'biz2',
          businessName: 'At Risk Salon',
          riskScore: 45,
          plan: 'pro',
          status: 'active',
          lastBooking: null,
          topSignal: 'Inactivity',
        },
      ],
    });

    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByTestId('at-risk-table')).toBeInTheDocument();
    });

    expect(screen.getByText('Troubled Clinic')).toBeInTheDocument();
    expect(screen.getByText('At Risk Salon')).toBeInTheDocument();
  });

  it('renders risk bar colors correctly (red >70, amber 30-70)', async () => {
    mockApi.get.mockResolvedValue({
      ...mockOverviewData,
      accountsAtRisk: [
        {
          businessId: 'biz1',
          businessName: 'High Risk',
          riskScore: 85,
          plan: 'basic',
          status: 'canceled',
          lastBooking: null,
          topSignal: 'Billing',
        },
      ],
    });

    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      const riskBar = screen.getByTestId('risk-bar');
      expect(riskBar.className).toContain('bg-red-500');
    });
  });

  it('links business names to Business 360 page', async () => {
    mockApi.get.mockResolvedValue({
      ...mockOverviewData,
      accountsAtRisk: [
        {
          businessId: 'biz123',
          businessName: 'Test Clinic',
          riskScore: 55,
          plan: 'pro',
          status: 'past_due',
          lastBooking: new Date().toISOString(),
          topSignal: 'Billing',
        },
      ],
    });

    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      const link = screen.getByTestId('business-link');
      expect(link).toHaveAttribute('href', '/console/businesses/biz123');
    });
  });

  it('shows "Never" for businesses with no bookings', async () => {
    mockApi.get.mockResolvedValue({
      ...mockOverviewData,
      accountsAtRisk: [
        {
          businessId: 'biz1',
          businessName: 'New Biz',
          riskScore: 50,
          plan: 'basic',
          status: 'active',
          lastBooking: null,
          topSignal: 'Inactivity',
        },
      ],
    });

    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Never')).toBeInTheDocument();
    });
  });

  it('existing KPIs still work correctly', async () => {
    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Bookings (7d)')).toBeInTheDocument();
    });

    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('Bookings (30d)')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
  });

  it('existing recent activity still works', async () => {
    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    expect(screen.getByText('Business lookup')).toBeInTheDocument();
  });
});

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
    // Spinner present via animate-spin class
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders overview data after loading', async () => {
    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Platform Overview')).toBeInTheDocument();
    });

    // Top KPIs
    expect(screen.getByText('9')).toBeInTheDocument(); // Total Businesses
    expect(screen.getByText('Total Businesses')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument(); // Active Subscriptions
    expect(screen.getByText('Active Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument(); // Bookings Today
    expect(screen.getByText('Bookings Today')).toBeInTheDocument();
    expect(screen.getByText('890')).toBeInTheDocument(); // Total Customers
    expect(screen.getByText('Total Customers')).toBeInTheDocument();
  });

  it('renders billing section with trial/past due/canceled counts', async () => {
    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Billing')).toBeInTheDocument();
    });

    expect(screen.getByText('Trial')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // trial count
    expect(screen.getByText('Past Due')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // past due count
    expect(screen.getByText('Canceled')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // canceled count
  });

  it('renders support section with open cases count', async () => {
    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Support')).toBeInTheDocument();
    });

    expect(screen.getByText('3')).toBeInTheDocument(); // open cases
    expect(screen.getByText('Open cases')).toBeInTheDocument();
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

  it('renders security section', async () => {
    render(<ConsoleOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Security')).toBeInTheDocument();
    });

    expect(screen.getByText('0 active view-as sessions')).toBeInTheDocument();
    expect(screen.getByText('No failed agent runs')).toBeInTheDocument();
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
});

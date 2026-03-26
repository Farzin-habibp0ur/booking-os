import { render, screen, waitFor } from '@testing-library/react';
import MarketingHubPage from './page';

jest.mock('lucide-react', () => ({
  Megaphone: () => <span data-testid="megaphone-icon" />,
  Zap: () => <span data-testid="zap-icon" />,
  Gift: () => <span data-testid="gift-icon" />,
  Users: () => <span data-testid="users-icon" />,
  ArrowRight: () => <span data-testid="arrow-right-icon" />,
}));

const mockApi = { get: jest.fn() };
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockApi.get(...args),
  },
}));

jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

jest.mock('@/components/skeleton', () => ({
  ListSkeleton: ({ rows }: { rows?: number }) => (
    <div data-testid="list-skeleton">Loading {rows} rows</div>
  ),
}));

const mockSummary = {
  supported: true,
  enabled: true,
  totalReferrals: 10,
  completedReferrals: 5,
  pendingReferrals: 3,
  conversionRate: 50,
  totalCreditsIssued: 250,
};

describe('MarketingHubPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockResolvedValue(mockSummary);
  });

  it('renders page title "Marketing"', async () => {
    render(<MarketingHubPage />);
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(
      screen.getByText('Manage campaigns, automations, offers, and referrals'),
    ).toBeInTheDocument();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
  });

  it('renders referrals card with correct link when supported', async () => {
    render(<MarketingHubPage />);

    await waitFor(() => {
      const referralsLink = screen.getByTestId('hub-card-referrals');
      expect(referralsLink).toHaveAttribute('href', '/marketing/referrals');
    });
  });

  it('hides referrals card when not supported', async () => {
    mockApi.get.mockResolvedValue({ supported: false });

    render(<MarketingHubPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('hub-card-referrals')).not.toBeInTheDocument();
    });
  });

  it('renders referral stats on successful API call', async () => {
    render(<MarketingHubPage />);

    await waitFor(() => {
      expect(screen.getByTestId('referral-stats-section')).toBeInTheDocument();
    });

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('$250')).toBeInTheDocument();
  });

  it('handles referral stats API error gracefully', async () => {
    mockApi.get.mockRejectedValue(new Error('API error'));

    render(<MarketingHubPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('list-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.queryByTestId('referral-stats-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('marketing-hub-page')).toBeInTheDocument();
  });

  it('calls stats/summary endpoint', async () => {
    render(<MarketingHubPage />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/referral/stats/summary');
    });
  });
});

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

const mockStats = {
  totalReferrals: 10,
  completedReferrals: 5,
  pendingReferrals: 3,
  totalCreditsIssued: 50,
  totalCreditsRedeemed: 20,
};

describe('MarketingHubPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockResolvedValue(mockStats);
  });

  it('renders page title "Marketing"', async () => {
    render(<MarketingHubPage />);
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(
      screen.getByText('Manage campaigns, automations, offers, and referrals'),
    ).toBeInTheDocument();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
  });

  it('renders all 4 hub cards with correct links', async () => {
    render(<MarketingHubPage />);

    const campaignsLink = screen.getByTestId('hub-card-campaigns');
    expect(campaignsLink).toHaveAttribute('href', '/campaigns');

    const automationsLink = screen.getByTestId('hub-card-automations');
    expect(automationsLink).toHaveAttribute('href', '/automations');

    const offersLink = screen.getByTestId('hub-card-offers');
    expect(offersLink).toHaveAttribute('href', '/settings/offers');

    const referralsLink = screen.getByTestId('hub-card-referrals');
    expect(referralsLink).toHaveAttribute('href', '/settings/referral');

    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
  });

  it('renders referral stats on successful API call', async () => {
    render(<MarketingHubPage />);

    await waitFor(() => {
      expect(screen.getByTestId('referral-stats-section')).toBeInTheDocument();
    });

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('$50')).toBeInTheDocument();
  });

  it('handles referral stats API error gracefully', async () => {
    mockApi.get.mockRejectedValue(new Error('API error'));

    render(<MarketingHubPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('list-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.queryByTestId('referral-stats-section')).not.toBeInTheDocument();
    // Page still renders without crashing
    expect(screen.getByTestId('marketing-hub-page')).toBeInTheDocument();
  });
});

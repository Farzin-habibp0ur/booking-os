import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PackagesPage from './page';

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}));

jest.mock('@/lib/design-tokens', () => ({
  PACKAGE_STATUS_STYLES: {
    ACTIVE: { bg: 'bg-sage-50', text: 'text-sage-900', label: 'Active' },
    EXHAUSTED: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Exhausted' },
  },
  packageBadgeClasses: (status: string) => status === 'ACTIVE' ? 'bg-sage-50 text-sage-900' : 'bg-slate-100 text-slate-600',
}));

jest.mock('@/components/skeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton">Loading...</div>,
}));

const { apiFetch } = require('@/lib/api');

describe('PackagesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockData = () => {
    apiFetch.mockImplementation((url: string) => {
      if (url === '/packages') {
        return Promise.resolve([
          {
            id: 'pkg-1',
            name: '10 Massage Sessions',
            description: 'Bundle of 10',
            serviceId: null,
            totalSessions: 10,
            price: '250.00',
            currency: 'USD',
            validityDays: 365,
            isActive: true,
            memberOnly: false,
            allowedMembershipTiers: [],
            service: null,
            _count: { purchases: 5 },
          },
        ]);
      }
      if (url === '/packages/stats') {
        return Promise.resolve({
          totalPackages: 3,
          activePurchases: 10,
          totalRevenue: 2500,
          totalRedemptions: 25,
        });
      }
      if (url === '/packages/purchases') {
        return Promise.resolve([
          {
            id: 'pur-1',
            totalSessions: 10,
            usedSessions: 3,
            status: 'ACTIVE',
            purchasedAt: '2026-01-15T12:00:00Z',
            expiresAt: '2027-01-15T12:00:00Z',
            package: { id: 'pkg-1', name: '10 Massage Sessions', serviceId: null, service: null },
            customer: { id: 'cust-1', name: 'Jane Doe', phone: '+1234567890' },
            _count: { redemptions: 3 },
          },
        ]);
      }
      if (url === '/services') return Promise.resolve([]);
      if (url === '/customers') return Promise.resolve([]);
      return Promise.resolve([]);
    });
  };

  it('shows skeleton while loading', () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    render(<PackagesPage />);
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
  });

  it('renders packages list', async () => {
    mockData();
    render(<PackagesPage />);

    await waitFor(() => {
      expect(screen.getByText('10 Massage Sessions')).toBeInTheDocument();
    });
    expect(screen.getByText('Session Packages')).toBeInTheDocument();
  });

  it('shows stats', async () => {
    mockData();
    render(<PackagesPage />);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // total packages
    });
    expect(screen.getByText('10')).toBeInTheDocument(); // active purchases
    expect(screen.getByText('$2,500')).toBeInTheDocument(); // revenue
    expect(screen.getByText('25')).toBeInTheDocument(); // redemptions
  });

  it('switches to purchases tab', async () => {
    mockData();
    render(<PackagesPage />);

    await waitFor(() => {
      expect(screen.getByText('10 Massage Sessions')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Purchases'));
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('3 / 10 used')).toBeInTheDocument();
  });

  it('opens create modal', async () => {
    mockData();
    render(<PackagesPage />);

    await waitFor(() => {
      expect(screen.getByText('New Package')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Package'));
    expect(screen.getByText('Create Package')).toBeInTheDocument();
  });

  it('shows error on API failure', async () => {
    apiFetch.mockRejectedValue(new Error('Network error'));
    render(<PackagesPage />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows empty state when no packages', async () => {
    apiFetch.mockImplementation((url: string) => {
      if (url === '/packages') return Promise.resolve([]);
      if (url === '/packages/stats') return Promise.resolve({ totalPackages: 0, activePurchases: 0, totalRevenue: 0, totalRedemptions: 0 });
      if (url === '/packages/purchases') return Promise.resolve([]);
      if (url === '/services') return Promise.resolve([]);
      if (url === '/customers') return Promise.resolve([]);
      return Promise.resolve([]);
    });

    render(<PackagesPage />);

    await waitFor(() => {
      expect(screen.getByText(/No packages yet/)).toBeInTheDocument();
    });
  });
});

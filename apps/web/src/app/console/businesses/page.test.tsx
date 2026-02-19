const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/console/businesses',
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
    user: { id: 'admin1', role: 'SUPER_ADMIN', email: 'admin@bookingos.com' },
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

jest.mock('lucide-react', () => ({
  Search: (props: any) => <div data-testid="search-icon" {...props} />,
  Building2: (props: any) => <div data-testid="building-icon" {...props} />,
}));

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BusinessDirectoryPage from './page';

const mockBusinesses = {
  items: [
    {
      id: 'biz1',
      name: 'Glow Aesthetic Clinic',
      slug: 'glow-clinic',
      verticalPack: 'aesthetics',
      health: 'green',
      owner: { email: 'admin@glow.com', name: 'Sarah' },
      plan: 'pro',
      billingStatus: 'active',
      lastActive: new Date().toISOString(),
      counts: { bookings: 50, customers: 20 },
    },
    {
      id: 'biz2',
      name: 'Auto Care Center',
      slug: 'auto-care',
      verticalPack: 'auto',
      health: 'yellow',
      owner: { email: 'mike@autocare.com', name: 'Mike' },
      plan: 'basic',
      billingStatus: 'past_due',
      lastActive: null,
      counts: { bookings: 10, customers: 5 },
    },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
};

describe('BusinessDirectoryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockResolvedValue(mockBusinesses);
  });

  it('renders loading state initially', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));

    render(<BusinessDirectoryPage />);

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders business list', async () => {
    render(<BusinessDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Glow Aesthetic Clinic')).toBeInTheDocument();
    });

    expect(screen.getByText('Auto Care Center')).toBeInTheDocument();
    expect(screen.getByText('glow-clinic')).toBeInTheDocument();
    expect(screen.getByText('2 total')).toBeInTheDocument();
  });

  it('renders empty state when no businesses', async () => {
    mockApi.get.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    render(<BusinessDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText('No businesses found')).toBeInTheDocument();
  });

  it('navigates to business 360 on row click', async () => {
    const user = userEvent.setup();

    render(<BusinessDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Glow Aesthetic Clinic')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('business-row-biz1'));
    });

    expect(mockPush).toHaveBeenCalledWith('/console/businesses/biz1');
  });

  it('debounces search input', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<BusinessDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    await act(async () => {
      await user.type(screen.getByTestId('search-input'), 'glow');
    });

    // Should debounce — initial call only
    expect(mockApi.get).toHaveBeenCalledTimes(1);

    // Advance past debounce
    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    // Should have called with search param
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.stringContaining('search=glow'),
    );

    jest.useRealTimers();
  });

  it('filters by plan', async () => {
    const user = userEvent.setup();

    render(<BusinessDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('filter-plan')).toBeInTheDocument();
    });

    await act(async () => {
      await user.selectOptions(screen.getByTestId('filter-plan'), 'pro');
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('plan=pro'),
      );
    });
  });

  it('shows owner email in table', async () => {
    render(<BusinessDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByText('admin@glow.com')).toBeInTheDocument();
    });
  });
});

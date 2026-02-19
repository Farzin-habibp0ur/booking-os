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
    'ChevronRight', 'Globe', 'Calendar', 'Users', 'MessageSquare',
    'ClipboardList', 'Megaphone', 'Bot', 'Eye',
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
    // Business name appears in breadcrumb and metadata
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

    expect(screen.getByText('4')).toBeInTheDocument(); // staff count
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
});

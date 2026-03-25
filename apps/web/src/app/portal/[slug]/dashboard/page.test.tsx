const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useParams: () => ({ slug: 'test-clinic' }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/design-tokens', () => ({
  statusBadgeClasses: (s: string) => `status-${s.toLowerCase()}`,
}));

import { render, screen, waitFor } from '@testing-library/react';
import PortalDashboardPage from './page';

const mockSessionStorage: Record<string, string> = {};
beforeAll(() => {
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: (key: string) => mockSessionStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockSessionStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockSessionStorage[key];
      },
    },
    writable: true,
  });
});

const mockProfile = {
  name: 'Jane Doe',
  email: 'jane@test.com',
  memberSince: '2025-06-15T00:00:00.000Z',
  totalBookings: 12,
  totalSpent: 450,
};

const mockUpcoming = [
  {
    id: 'b1',
    startTime: '2027-02-01T10:00:00.000Z',
    status: 'CONFIRMED',
    service: { name: 'Facial Treatment' },
    staff: { name: 'Dr. Smith' },
  },
];

const mockBookings = {
  data: [
    {
      id: 'b2',
      startTime: '2025-12-15T14:00:00.000Z',
      status: 'COMPLETED',
      service: { name: 'Botox' },
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
  mockSessionStorage['portal-token'] = 'test-token';

  (global.fetch as jest.Mock) = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/portal/me')) {
      return Promise.resolve({ status: 200, json: () => Promise.resolve(mockProfile) });
    }
    if (url.includes('/portal/upcoming')) {
      return Promise.resolve({ status: 200, json: () => Promise.resolve(mockUpcoming) });
    }
    if (url.includes('/portal/bookings')) {
      return Promise.resolve({ status: 200, json: () => Promise.resolve(mockBookings) });
    }
    return Promise.resolve({ status: 200, json: () => Promise.resolve({}) });
  });
});

describe('PortalDashboardPage', () => {
  it('renders welcome message with user name', async () => {
    render(<PortalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Jane/)).toBeInTheDocument();
    });
  });

  it('renders upcoming bookings', async () => {
    render(<PortalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-bookings')).toBeInTheDocument();
    });
    expect(screen.getByText('Facial Treatment')).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
  });

  it('renders quick actions', async () => {
    render(<PortalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
    });
    expect(screen.getByText('Book Again')).toBeInTheDocument();
    expect(screen.getByText('My Bookings')).toBeInTheDocument();
    expect(screen.getByText('My Profile')).toBeInTheDocument();
  });

  it('renders recent bookings', async () => {
    render(<PortalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('recent-bookings')).toBeInTheDocument();
    });
    expect(screen.getByText('Botox')).toBeInTheDocument();
  });

  it('redirects to login when no token', () => {
    delete mockSessionStorage['portal-token'];

    render(<PortalDashboardPage />);

    expect(mockReplace).toHaveBeenCalledWith('/portal/test-clinic');
  });

  it('shows member since date', async () => {
    render(<PortalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Member since/)).toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from './page';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'test-id' }),
}));

// Mock next/link
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

// Mock auth
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    login: jest.fn(),
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

// Mock i18n
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
  I18nProvider: ({ children }: any) => children,
}));

// Mock vertical-pack
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
    customerFields: [],
  }),
  VerticalPackProvider: ({ children }: any) => children,
}));

// Mock toast
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
  ToastProvider: ({ children }: any) => children,
}));

// Mock cn
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock api
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
    upload: jest.fn(),
  },
}));

// Mock skeleton components
jest.mock('@/components/skeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton">Loading...</div>,
  TableRowSkeleton: () => (
    <tr data-testid="table-skeleton">
      <td />
    </tr>
  ),
  EmptyState: ({ title }: any) => <div data-testid="empty-state">{title}</div>,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Calendar: () => <div data-testid="calendar-icon" />,
  MessageSquare: () => <div data-testid="message-square-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  TrendingDown: () => <div data-testid="trending-down-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Users: () => <div data-testid="users-icon" />,
  DollarSign: () => <div data-testid="dollar-sign-icon" />,
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  CheckCircle2: () => <div data-testid="check-circle-2-icon" />,
  XCircle: () => <div data-testid="x-circle-icon" />,
  CircleDot: () => <div data-testid="circle-dot-icon" />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows skeleton while loading', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<DashboardPage />);

    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to /setup if setup not complete', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/business') {
        return Promise.resolve({ packConfig: {} });
      }
      return Promise.resolve({});
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/setup');
    });
  });

  it('renders dashboard with metrics after loading', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/business') {
        return Promise.resolve({
          packConfig: { setupComplete: true },
        });
      }
      if (path === '/dashboard') {
        return Promise.resolve({
          metrics: {
            totalBookingsThisWeek: 12,
            totalBookingsLastWeek: 8,
            revenueThisMonth: 1500,
            totalCustomers: 10,
            newCustomersThisWeek: 2,
            openConversationCount: 3,
            avgResponseTimeMins: 5,
            noShowRate: 8,
          },
          statusBreakdown: [],
          todayBookings: [],
          unassignedConversations: [],
        });
      }
      return Promise.resolve({});
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    // Check that metric values are rendered
    expect(screen.getByText('12')).toBeInTheDocument(); // totalBookingsThisWeek
    expect(screen.getByText('$1,500')).toBeInTheDocument(); // revenueThisMonth
    expect(screen.getByText('10')).toBeInTheDocument(); // totalCustomers
    expect(screen.getByText('3')).toBeInTheDocument(); // openConversationCount
    expect(screen.getByText('8%')).toBeInTheDocument(); // noShowRate
  });

  it('shows today appointments when present', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/business') {
        return Promise.resolve({
          packConfig: { setupComplete: true },
        });
      }
      if (path === '/dashboard') {
        return Promise.resolve({
          metrics: {
            totalBookingsThisWeek: 5,
            totalBookingsLastWeek: 3,
            revenueThisMonth: 1500,
            totalCustomers: 10,
            newCustomersThisWeek: 2,
            openConversationCount: 3,
            avgResponseTimeMins: 5,
            noShowRate: 8,
          },
          statusBreakdown: [],
          todayBookings: [
            {
              id: 'b1',
              customer: { name: 'John Doe' },
              service: { name: 'Haircut' },
              staff: { name: 'Sarah' },
              startTime: '2026-02-15T10:00:00Z',
              status: 'CONFIRMED',
            },
            {
              id: 'b2',
              customer: { name: 'Jane Smith' },
              service: { name: 'Massage' },
              staff: { name: 'Mike' },
              startTime: '2026-02-15T14:00:00Z',
              status: 'PENDING',
            },
          ],
          unassignedConversations: [],
        });
      }
      return Promise.resolve({});
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    // Check for customer names
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    // Check for service names - they appear in multiple places so use getAllByText
    const haircutElements = screen.getAllByText((content, element) => {
      return content.includes('Haircut');
    });
    expect(haircutElements.length).toBeGreaterThan(0);

    const massageElements = screen.getAllByText((content, element) => {
      return content.includes('Massage');
    });
    expect(massageElements.length).toBeGreaterThan(0);
  });

  it('shows empty state for today appointments', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/business') {
        return Promise.resolve({
          packConfig: { setupComplete: true },
        });
      }
      if (path === '/dashboard') {
        return Promise.resolve({
          metrics: {
            totalBookingsThisWeek: 5,
            totalBookingsLastWeek: 3,
            revenueThisMonth: 1500,
            totalCustomers: 10,
            newCustomersThisWeek: 2,
            openConversationCount: 3,
            avgResponseTimeMins: 5,
            noShowRate: 8,
          },
          statusBreakdown: [],
          todayBookings: [],
          unassignedConversations: [],
        });
      }
      return Promise.resolve({});
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.no_appointments_today')).toBeInTheDocument();
    });
  });

  it('shows error state when data fails to load', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/business') {
        return Promise.resolve({
          packConfig: { setupComplete: true },
        });
      }
      if (path === '/dashboard') {
        return Promise.reject(new Error('Failed to load'));
      }
      return Promise.resolve({});
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.failed_to_load')).toBeInTheDocument();
    });
  });
});

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
jest.mock('@/lib/auth', () => {
  let mockUser: any = { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' };
  return {
    useAuth: () => ({
      login: jest.fn(),
      user: mockUser,
      loading: false,
    }),
    AuthProvider: ({ children }: any) => children,
    __setMockUser: (u: any) => {
      mockUser = u;
    },
  };
});

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

// Mock mode system
let mockMode = 'admin';
jest.mock('@/lib/use-mode', () => ({
  useMode: () => ({
    mode: mockMode,
    setMode: jest.fn(),
    availableModes: [],
    modeLabel: 'Admin',
    landingPath: '/dashboard',
    modeDef: { key: 'admin', primaryNavPaths: ['/dashboard'] },
  }),
  ModeProvider: ({ children }: any) => children,
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
  Calendar: (props: any) => <div data-testid="calendar-icon" {...props} />,
  MessageSquare: (props: any) => <div data-testid="message-square-icon" {...props} />,
  TrendingUp: (props: any) => <div data-testid="trending-up-icon" {...props} />,
  TrendingDown: (props: any) => <div data-testid="trending-down-icon" {...props} />,
  Clock: (props: any) => <div data-testid="clock-icon" {...props} />,
  Users: (props: any) => <div data-testid="users-icon" {...props} />,
  DollarSign: (props: any) => <div data-testid="dollar-sign-icon" {...props} />,
  ArrowRight: (props: any) => <div data-testid="arrow-right-icon" {...props} />,
  AlertCircle: (props: any) => <div data-testid="alert-circle-icon" {...props} />,
  CheckCircle2: (props: any) => <div data-testid="check-circle-2-icon" {...props} />,
  XCircle: (props: any) => <div data-testid="x-circle-icon" {...props} />,
  CircleDot: (props: any) => <div data-testid="circle-dot-icon" {...props} />,
  AlertTriangle: (props: any) => <div data-testid="alert-triangle-icon" {...props} />,
  Check: (props: any) => <div data-testid="check-icon" {...props} />,
  Circle: (props: any) => <div data-testid="circle-icon" {...props} />,
  X: (props: any) => <button data-testid="x-dismiss-icon" onClick={props.onClick} {...props} />,
  Target: (props: any) => <div data-testid="target-icon" {...props} />,
  ClipboardList: (props: any) => <div data-testid="clipboard-list-icon" {...props} />,
  Clock: (props: any) => <div data-testid="clock-icon" {...props} />,
  Search: (props: any) => <div data-testid="search-icon" {...props} />,
  Star: (props: any) => <div data-testid="star-icon" {...props} />,
  Flag: (props: any) => <div data-testid="flag-icon" {...props} />,
  Bookmark: (props: any) => <div data-testid="bookmark-icon" {...props} />,
  Heart: (props: any) => <div data-testid="heart-icon" {...props} />,
  Eye: (props: any) => <div data-testid="eye-icon" {...props} />,
  Bell: (props: any) => <div data-testid="bell-icon" {...props} />,
  Zap: (props: any) => <div data-testid="zap-icon" {...props} />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

// Helper: base metrics object
const baseMetrics = {
  totalBookingsThisWeek: 12,
  totalBookingsLastWeek: 8,
  revenueThisMonth: 1500,
  totalCustomers: 10,
  newCustomersThisWeek: 2,
  openConversationCount: 3,
  avgResponseTimeMins: 5,
  noShowRate: 8,
};

// Helper: base dashboard data
const baseDashboardData = {
  metrics: baseMetrics,
  statusBreakdown: [],
  todayBookings: [],
  unassignedConversations: [],
  consultConversion: { rate: 45, converted: 9, consultCustomers: 20 },
};

// Helper: mock API calls for setup-complete dashboard
const mockDashboard = (dashboardData: any = baseDashboardData) => {
  mockApi.get.mockImplementation((path: string) => {
    if (path === '/business') {
      return Promise.resolve({ packConfig: { setupComplete: true } });
    }
    if (path === '/dashboard') {
      return Promise.resolve(dashboardData);
    }
    return Promise.resolve({});
  });
};

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMode = 'admin';
    // Reset auth back to ADMIN
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const authMod = require('@/lib/auth');
    if (authMod.__setMockUser) {
      authMod.__setMockUser({ id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' });
    }
  });

  // ─── Loading State ──────────────────────────────────────────

  it('shows skeleton while loading', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<DashboardPage />);

    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // ─── Setup Redirect ─────────────────────────────────────────

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

  it('redirects to /setup if packConfig is null', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/business') {
        return Promise.resolve({ packConfig: null });
      }
      return Promise.resolve({});
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/setup');
    });
  });

  // ─── Error State ────────────────────────────────────────────

  it('shows error state when data fails to load', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/business') {
        return Promise.resolve({ packConfig: { setupComplete: true } });
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

  it('shows error state when business API fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockApi.get.mockRejectedValue(new Error('Network error'));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.failed_to_load')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  // ─── Metric Cards Rendering ─────────────────────────────────

  it('renders dashboard with title and date', async () => {
    mockDashboard();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });
  });

  it('displays all metric card values', async () => {
    mockDashboard();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument(); // totalBookingsThisWeek
      expect(screen.getByText('$1,500')).toBeInTheDocument(); // revenueThisMonth
      expect(screen.getByText('10')).toBeInTheDocument(); // totalCustomers
      expect(screen.getByText('3')).toBeInTheDocument(); // openConversationCount
    });
  });

  it('displays metric card labels', async () => {
    mockDashboard();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.bookings_this_week')).toBeInTheDocument();
      expect(screen.getByText('dashboard.revenue_30d')).toBeInTheDocument();
      expect(screen.getByText('dashboard.total_customers')).toBeInTheDocument();
      expect(screen.getByText('dashboard.open_conversations')).toBeInTheDocument();
    });
  });

  it('shows positive week-over-week change for bookings', async () => {
    mockDashboard({
      ...baseDashboardData,
      metrics: { ...baseMetrics, totalBookingsThisWeek: 12, totalBookingsLastWeek: 8 },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      // weekChange = ((12-8)/8)*100 = 50 -> "+50" is rendered via t('dashboard.vs_last_week', { change: '+50' })
      expect(screen.getByText('dashboard.vs_last_week')).toBeInTheDocument();
    });
  });

  it('shows negative week-over-week change for bookings', async () => {
    mockDashboard({
      ...baseDashboardData,
      metrics: { ...baseMetrics, totalBookingsThisWeek: 4, totalBookingsLastWeek: 8 },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      // weekChange = ((4-8)/8)*100 = -50
      expect(screen.getByText('dashboard.vs_last_week')).toBeInTheDocument();
    });
  });

  it('shows same_as_last_week when no change', async () => {
    mockDashboard({
      ...baseDashboardData,
      metrics: { ...baseMetrics, totalBookingsThisWeek: 8, totalBookingsLastWeek: 8 },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.same_as_last_week')).toBeInTheDocument();
    });
  });

  it('shows 100% increase when last week was 0 but this week has bookings', async () => {
    mockDashboard({
      ...baseDashboardData,
      metrics: { ...baseMetrics, totalBookingsThisWeek: 5, totalBookingsLastWeek: 0 },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.vs_last_week')).toBeInTheDocument();
    });
  });

  it('shows same_as_last_week when both weeks are 0', async () => {
    mockDashboard({
      ...baseDashboardData,
      metrics: { ...baseMetrics, totalBookingsThisWeek: 0, totalBookingsLastWeek: 0 },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.same_as_last_week')).toBeInTheDocument();
    });
  });

  it('shows new customers this week subtitle', async () => {
    mockDashboard({
      ...baseDashboardData,
      metrics: { ...baseMetrics, newCustomersThisWeek: 3 },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.this_week_count')).toBeInTheDocument();
    });
  });

  it('does not show new customers subtitle when count is 0', async () => {
    mockDashboard({
      ...baseDashboardData,
      metrics: { ...baseMetrics, newCustomersThisWeek: 0 },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByText('dashboard.this_week_count')).not.toBeInTheDocument();
  });

  // ─── No-Show Rate ──────────────────────────────────────────

  it('displays no-show rate', async () => {
    mockDashboard();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.no_show_rate')).toBeInTheDocument();
      expect(screen.getByText('8%')).toBeInTheDocument();
    });
  });

  it('shows high no-show rate with appropriate styling (>15%)', async () => {
    mockDashboard({
      ...baseDashboardData,
      metrics: { ...baseMetrics, noShowRate: 20 },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('20%')).toBeInTheDocument();
    });
  });

  // ─── Average Response Time ──────────────────────────────────

  it('displays average response time', async () => {
    mockDashboard();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.avg_response_time')).toBeInTheDocument();
      expect(screen.getByText('dashboard.min_short')).toBeInTheDocument();
    });
  });

  it('shows excellent response time rating (<=5 min)', async () => {
    mockDashboard({
      ...baseDashboardData,
      metrics: { ...baseMetrics, avgResponseTimeMins: 3 },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.excellent')).toBeInTheDocument();
    });
  });

  it('shows good response time rating (<=15 min)', async () => {
    mockDashboard({
      ...baseDashboardData,
      metrics: { ...baseMetrics, avgResponseTimeMins: 10 },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.good')).toBeInTheDocument();
    });
  });

  it('shows needs improvement rating (>15 min)', async () => {
    mockDashboard({
      ...baseDashboardData,
      metrics: { ...baseMetrics, avgResponseTimeMins: 25 },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.needs_improvement')).toBeInTheDocument();
    });
  });

  // ─── Consult to Treatment Conversion ────────────────────────

  it('displays consult conversion rate', async () => {
    mockDashboard();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('45%')).toBeInTheDocument();
    });
  });

  it('shows 0% conversion when consultConversion is null', async () => {
    mockDashboard({
      ...baseDashboardData,
      consultConversion: null,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  // ─── Status Breakdown ──────────────────────────────────────

  it('displays status breakdown items', async () => {
    mockDashboard({
      ...baseDashboardData,
      statusBreakdown: [
        { status: 'CONFIRMED', count: 17 },
        { status: 'PENDING', count: 9 },
        { status: 'CANCELLED', count: 4 },
      ],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.this_week_by_status')).toBeInTheDocument();
      expect(screen.getByText('status.confirmed')).toBeInTheDocument();
      expect(screen.getByText('status.pending')).toBeInTheDocument();
      expect(screen.getByText('status.cancelled')).toBeInTheDocument();
      expect(screen.getByText('17')).toBeInTheDocument();
      expect(screen.getByText('9')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  it('shows no bookings this week when status breakdown is empty', async () => {
    mockDashboard({
      ...baseDashboardData,
      statusBreakdown: [],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.no_bookings_this_week')).toBeInTheDocument();
    });
  });

  it('shows no bookings when statusBreakdown is null', async () => {
    mockDashboard({
      ...baseDashboardData,
      statusBreakdown: null,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.no_bookings_this_week')).toBeInTheDocument();
    });
  });

  // ─── Today's Appointments ───────────────────────────────────

  it('shows today appointments when present', async () => {
    mockDashboard({
      ...baseDashboardData,
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
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('shows empty state for today appointments when none', async () => {
    mockDashboard({
      ...baseDashboardData,
      todayBookings: [],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.no_appointments_today')).toBeInTheDocument();
    });
  });

  it('displays consult badge for CONSULT service kind', async () => {
    mockDashboard({
      ...baseDashboardData,
      todayBookings: [
        {
          id: 'b1',
          customer: { name: 'Alice' },
          service: { name: 'Skin Consult', kind: 'CONSULT' },
          staff: { name: 'Dr. Smith' },
          startTime: '2026-02-15T10:00:00Z',
          status: 'CONFIRMED',
        },
      ],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('C')).toBeInTheDocument();
    });
  });

  it('displays treatment badge for TREATMENT service kind', async () => {
    mockDashboard({
      ...baseDashboardData,
      todayBookings: [
        {
          id: 'b1',
          customer: { name: 'Bob' },
          service: { name: 'Botox', kind: 'TREATMENT' },
          staff: { name: 'Dr. Smith' },
          startTime: '2026-02-15T10:00:00Z',
          status: 'CONFIRMED',
        },
      ],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('T')).toBeInTheDocument();
    });
  });

  it('shows appointment without staff name when staff is null', async () => {
    mockDashboard({
      ...baseDashboardData,
      todayBookings: [
        {
          id: 'b1',
          customer: { name: 'Charlie' },
          service: { name: 'Facial' },
          staff: null,
          startTime: '2026-02-15T11:00:00Z',
          status: 'PENDING',
        },
      ],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });
  });

  it('navigates to /calendar when view calendar button is clicked', async () => {
    const user = userEvent.setup();
    mockDashboard();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    const viewCalendarButtons = screen.getAllByText('dashboard.view_calendar');
    await act(async () => {
      await user.click(viewCalendarButtons[0]);
    });

    expect(mockPush).toHaveBeenCalledWith('/calendar');
  });

  // ─── Unassigned Conversations ───────────────────────────────

  it('shows unassigned conversations when present', async () => {
    mockDashboard({
      ...baseDashboardData,
      unassignedConversations: [
        {
          id: 'c1',
          customer: { name: 'Dave' },
          messages: [{ content: 'Hello, I need help' }],
          lastMessageAt: new Date().toISOString(),
        },
      ],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Dave')).toBeInTheDocument();
      expect(screen.getByText('Hello, I need help')).toBeInTheDocument();
      expect(screen.getByText('dashboard.unassigned_badge')).toBeInTheDocument();
    });
  });

  it('shows "all caught up" when no unassigned conversations', async () => {
    mockDashboard({
      ...baseDashboardData,
      unassignedConversations: [],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.all_caught_up')).toBeInTheDocument();
    });
  });

  it('shows "no messages" when conversation has no messages', async () => {
    mockDashboard({
      ...baseDashboardData,
      unassignedConversations: [
        {
          id: 'c1',
          customer: { name: 'Eve' },
          messages: [],
          lastMessageAt: null,
        },
      ],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.no_messages')).toBeInTheDocument();
    });
  });

  it('navigates to /inbox when clicking an unassigned conversation', async () => {
    const user = userEvent.setup();
    mockDashboard({
      ...baseDashboardData,
      unassignedConversations: [
        {
          id: 'c1',
          customer: { name: 'Frank' },
          messages: [{ content: 'Need info' }],
          lastMessageAt: null,
        },
      ],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Frank')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Frank'));
    });

    expect(mockPush).toHaveBeenCalledWith('/inbox');
  });

  it('navigates to /inbox?filter=unassigned when view inbox is clicked', async () => {
    const user = userEvent.setup();
    mockDashboard();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    const viewInboxButton = screen.getByText('dashboard.view_inbox');
    await act(async () => {
      await user.click(viewInboxButton);
    });

    expect(mockPush).toHaveBeenCalledWith('/inbox?filter=unassigned');
  });

  // ─── Attention Needed Panel ─────────────────────────────────

  it('shows attention needed panel with deposit pending', async () => {
    mockDashboard({
      ...baseDashboardData,
      attentionNeeded: {
        depositPendingBookings: [
          { id: 'b1', customer: { name: 'Pending Joe' }, service: { name: 'Filler' } },
        ],
        overdueConversations: [],
        tomorrowBookings: [],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.attention_needed')).toBeInTheDocument();
      expect(screen.getByText('dashboard.deposit_pending')).toBeInTheDocument();
      expect(screen.getByText('Pending Joe')).toBeInTheDocument();
      expect(screen.getByText('Filler')).toBeInTheDocument();
    });
  });

  it('shows attention needed panel with overdue conversations', async () => {
    mockDashboard({
      ...baseDashboardData,
      attentionNeeded: {
        depositPendingBookings: [],
        overdueConversations: [
          {
            id: 'c1',
            customer: { name: 'Overdue Mary' },
            lastMessageAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
        tomorrowBookings: [],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.attention_needed')).toBeInTheDocument();
      expect(screen.getByText('dashboard.overdue_replies')).toBeInTheDocument();
      expect(screen.getByText('Overdue Mary')).toBeInTheDocument();
    });
  });

  it('shows attention needed panel with tomorrow bookings', async () => {
    mockDashboard({
      ...baseDashboardData,
      attentionNeeded: {
        depositPendingBookings: [],
        overdueConversations: [],
        tomorrowBookings: [
          { id: 'b1', customer: { name: 'Tomorrow Tom' }, startTime: '2026-02-17T09:00:00Z' },
        ],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.attention_needed')).toBeInTheDocument();
      expect(screen.getByText('dashboard.tomorrow_schedule')).toBeInTheDocument();
      expect(screen.getByText('Tomorrow Tom')).toBeInTheDocument();
    });
  });

  it('does not show attention panel when no attention items', async () => {
    mockDashboard({
      ...baseDashboardData,
      attentionNeeded: {
        depositPendingBookings: [],
        overdueConversations: [],
        tomorrowBookings: [],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByText('dashboard.attention_needed')).not.toBeInTheDocument();
  });

  it('does not show attention panel when attentionNeeded is absent', async () => {
    mockDashboard({
      ...baseDashboardData,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByText('dashboard.attention_needed')).not.toBeInTheDocument();
  });

  it('shows up to 3 deposit pending items only', async () => {
    mockDashboard({
      ...baseDashboardData,
      attentionNeeded: {
        depositPendingBookings: [
          { id: 'b1', customer: { name: 'A1' }, service: { name: 'S1' } },
          { id: 'b2', customer: { name: 'A2' }, service: { name: 'S2' } },
          { id: 'b3', customer: { name: 'A3' }, service: { name: 'S3' } },
          { id: 'b4', customer: { name: 'A4' }, service: { name: 'S4' } },
        ],
        overdueConversations: [],
        tomorrowBookings: [],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('A1')).toBeInTheDocument();
      expect(screen.getByText('A2')).toBeInTheDocument();
      expect(screen.getByText('A3')).toBeInTheDocument();
      // A4 should not be displayed (only first 3)
      expect(screen.queryByText('A4')).not.toBeInTheDocument();
    });
  });

  it('navigates to bookings with deposit filter when deposit view link clicked', async () => {
    const user = userEvent.setup();
    mockDashboard({
      ...baseDashboardData,
      attentionNeeded: {
        depositPendingBookings: [
          { id: 'b1', customer: { name: 'Dep1' }, service: { name: 'Svc1' } },
        ],
        overdueConversations: [],
        tomorrowBookings: [],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.view_deposit_pending')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('dashboard.view_deposit_pending'));
    });

    expect(mockPush).toHaveBeenCalledWith('/bookings?status=PENDING_DEPOSIT');
  });

  it('navigates to inbox with overdue filter when overdue view link clicked', async () => {
    const user = userEvent.setup();
    mockDashboard({
      ...baseDashboardData,
      attentionNeeded: {
        depositPendingBookings: [],
        overdueConversations: [
          {
            id: 'c1',
            customer: { name: 'Late1' },
            lastMessageAt: new Date(Date.now() - 7200000).toISOString(),
          },
        ],
        tomorrowBookings: [],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.view_overdue')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('dashboard.view_overdue'));
    });

    expect(mockPush).toHaveBeenCalledWith('/inbox?filter=overdue');
  });

  it('navigates to calendar when tomorrow view link clicked', async () => {
    const user = userEvent.setup();
    mockDashboard({
      ...baseDashboardData,
      attentionNeeded: {
        depositPendingBookings: [],
        overdueConversations: [],
        tomorrowBookings: [
          { id: 'b1', customer: { name: 'Tom1' }, startTime: '2026-02-17T09:00:00Z' },
        ],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.view_tomorrow')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('dashboard.view_tomorrow'));
    });

    expect(mockPush).toHaveBeenCalledWith('/calendar');
  });

  // ─── Go-Live Checklist ──────────────────────────────────────

  it('shows go-live checklist for admin when not all complete', async () => {
    mockDashboard({
      ...baseDashboardData,
      goLiveChecklist: {
        allComplete: false,
        items: [
          { key: 'business_name', done: true },
          { key: 'staff_added', done: false, fixUrl: '/settings' },
          { key: 'services_created', done: false, fixUrl: '/services' },
        ],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.go_live_title')).toBeInTheDocument();
      expect(screen.getByText('dashboard.go_live_progress')).toBeInTheDocument();
    });
  });

  it('shows fix button for incomplete checklist items', async () => {
    const user = userEvent.setup();
    mockDashboard({
      ...baseDashboardData,
      goLiveChecklist: {
        allComplete: false,
        items: [
          { key: 'business_name', done: true },
          { key: 'staff_added', done: false, fixUrl: '/settings/staff' },
        ],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      // Fix button should be present
      const fixButtons = screen.getAllByText('dashboard.fix');
      expect(fixButtons.length).toBeGreaterThan(0);
    });

    // Click a fix button
    const fixButtons = screen.getAllByText('dashboard.fix');
    await act(async () => {
      await user.click(fixButtons[0]);
    });

    expect(mockPush).toHaveBeenCalledWith('/settings/staff');
  });

  it('hides go-live checklist when all items are complete', async () => {
    mockDashboard({
      ...baseDashboardData,
      goLiveChecklist: {
        allComplete: true,
        items: [
          { key: 'business_name', done: true },
          { key: 'staff_added', done: true },
        ],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByText('dashboard.go_live_title')).not.toBeInTheDocument();
  });

  it('hides go-live checklist when checklist is absent', async () => {
    mockDashboard({
      ...baseDashboardData,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByText('dashboard.go_live_title')).not.toBeInTheDocument();
  });

  it('hides go-live checklist for non-admin users', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const authMod = require('@/lib/auth');
    authMod.__setMockUser({ id: '2', name: 'Mike', role: 'STAFF', businessId: 'b1' });

    mockDashboard({
      ...baseDashboardData,
      goLiveChecklist: {
        allComplete: false,
        items: [{ key: 'business_name', done: false, fixUrl: '/settings' }],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByText('dashboard.go_live_title')).not.toBeInTheDocument();
  });

  // ─── Milestone Progress ─────────────────────────────────────

  it('shows milestone progress when completedBookings < 10', async () => {
    mockDashboard({
      ...baseDashboardData,
      milestoneProgress: {
        completedBookings: 3,
        currentNudge: null,
        dismissedNudges: [],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.milestone_title')).toBeInTheDocument();
      expect(screen.getByText('dashboard.milestone_progress')).toBeInTheDocument();
    });
  });

  it('shows milestone with nudge message', async () => {
    mockDashboard({
      ...baseDashboardData,
      milestoneProgress: {
        completedBookings: 3,
        currentNudge: {
          id: 'nudge_3',
          link: '/bookings',
        },
        dismissedNudges: [],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.nudge_gaining_momentum')).toBeInTheDocument();
      expect(screen.getByText('dashboard.nudge_action')).toBeInTheDocument();
    });
  });

  it('navigates when nudge action link is clicked', async () => {
    const user = userEvent.setup();
    mockDashboard({
      ...baseDashboardData,
      milestoneProgress: {
        completedBookings: 1,
        currentNudge: {
          id: 'nudge_1',
          link: '/bookings/new',
        },
        dismissedNudges: [],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.nudge_action')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('dashboard.nudge_action'));
    });

    expect(mockPush).toHaveBeenCalledWith('/bookings/new');
  });

  it('dismisses nudge when X button is clicked', async () => {
    const user = userEvent.setup();
    mockApi.patch.mockResolvedValue({});
    mockDashboard({
      ...baseDashboardData,
      milestoneProgress: {
        completedBookings: 5,
        currentNudge: {
          id: 'nudge_5',
          link: '/bookings',
        },
        dismissedNudges: [],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.nudge_halfway_there')).toBeInTheDocument();
    });

    // Find and click the dismiss button (X icon rendered as a button)
    const dismissButtons = screen.getAllByTestId('x-dismiss-icon');
    // Click the one that's inside the nudge area
    await act(async () => {
      // The X dismiss icon is rendered inside a button, click the parent button
      const parentButton = dismissButtons[0].closest('button');
      if (parentButton && parentButton !== dismissButtons[0]) {
        await user.click(parentButton);
      } else {
        await user.click(dismissButtons[0]);
      }
    });

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/dashboard/dismiss-nudge', {
        nudgeId: 'nudge_5',
      });
    });
  });

  it('hides milestone when completedBookings >= 10 and no current nudge', async () => {
    mockDashboard({
      ...baseDashboardData,
      milestoneProgress: {
        completedBookings: 15,
        currentNudge: null,
        dismissedNudges: [],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByText('dashboard.milestone_title')).not.toBeInTheDocument();
  });

  it('shows milestone when completedBookings >= 10 but currentNudge exists', async () => {
    mockDashboard({
      ...baseDashboardData,
      milestoneProgress: {
        completedBookings: 10,
        currentNudge: {
          id: 'nudge_10',
          link: '/dashboard',
        },
        dismissedNudges: [],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.milestone_title')).toBeInTheDocument();
      expect(screen.getByText('dashboard.nudge_ten_complete')).toBeInTheDocument();
    });
  });

  it('hides milestone section when milestoneProgress is absent', async () => {
    mockDashboard({
      ...baseDashboardData,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByText('dashboard.milestone_title')).not.toBeInTheDocument();
  });

  // ─── Waitlist Backfill ──────────────────────────────────────

  it('shows waitlist backfill section when data present', async () => {
    mockDashboard({
      ...baseDashboardData,
      waitlistMetrics: {
        totalEntries: 15,
        offers: 10,
        claimed: 7,
        fillRate: 70,
        avgTimeToFill: 45,
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Waitlist Backfill')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
    });
  });

  it('shows avg time to fill when > 0', async () => {
    mockDashboard({
      ...baseDashboardData,
      waitlistMetrics: {
        totalEntries: 5,
        offers: 3,
        claimed: 2,
        fillRate: 66,
        avgTimeToFill: 30,
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Avg. time to fill: 30 min')).toBeInTheDocument();
    });
  });

  it('hides avg time to fill when 0', async () => {
    mockDashboard({
      ...baseDashboardData,
      waitlistMetrics: {
        totalEntries: 5,
        offers: 3,
        claimed: 2,
        fillRate: 66,
        avgTimeToFill: 0,
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Waitlist Backfill')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Avg\. time to fill/)).not.toBeInTheDocument();
  });

  it('hides waitlist backfill when totalEntries is 0', async () => {
    mockDashboard({
      ...baseDashboardData,
      waitlistMetrics: {
        totalEntries: 0,
        offers: 0,
        claimed: 0,
        fillRate: 0,
        avgTimeToFill: 0,
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByText('Waitlist Backfill')).not.toBeInTheDocument();
  });

  it('hides waitlist backfill when waitlistMetrics is absent', async () => {
    mockDashboard({
      ...baseDashboardData,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByText('Waitlist Backfill')).not.toBeInTheDocument();
  });

  // ─── Attention Panel Counts ─────────────────────────────────

  it('shows correct count badges in attention panel', async () => {
    mockDashboard({
      ...baseDashboardData,
      attentionNeeded: {
        depositPendingBookings: [
          { id: 'b1', customer: { name: 'X1' }, service: { name: 'S1' } },
          { id: 'b2', customer: { name: 'X2' }, service: { name: 'S2' } },
        ],
        overdueConversations: [
          {
            id: 'c1',
            customer: { name: 'Y1' },
            lastMessageAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
        tomorrowBookings: [
          { id: 'tb1', customer: { name: 'Z1' }, startTime: '2026-02-17T09:00:00Z' },
          { id: 'tb2', customer: { name: 'Z2' }, startTime: '2026-02-17T10:00:00Z' },
          { id: 'tb3', customer: { name: 'Z3' }, startTime: '2026-02-17T11:00:00Z' },
        ],
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      // The count badges should display the correct numbers
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  // ─── Revenue Formatting ─────────────────────────────────────

  it('formats large revenue numbers with commas', async () => {
    mockDashboard({
      ...baseDashboardData,
      metrics: { ...baseMetrics, revenueThisMonth: 125000 },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });
  });

  it('formats zero revenue', async () => {
    mockDashboard({
      ...baseDashboardData,
      metrics: { ...baseMetrics, revenueThisMonth: 0 },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('$0')).toBeInTheDocument();
    });
  });

  // ─── Mode-Aware Layout ─────────────────────────────────────

  it('shows KPI strip for agent mode', async () => {
    mockMode = 'agent';
    mockDashboard({
      ...baseDashboardData,
      myBookingsToday: [
        {
          id: 'mb1',
          customer: { name: 'MyClient' },
          service: { name: 'Cut' },
          startTime: '2026-02-17T09:00:00Z',
          status: 'CONFIRMED',
        },
      ],
      myAssignedConversations: [],
      completedTodayByStaff: 0,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('kpi-strip')).toBeInTheDocument();
    });
  });

  it('shows KPI strip for provider mode', async () => {
    mockMode = 'provider';
    mockDashboard({
      ...baseDashboardData,
      myBookingsToday: [],
      myAssignedConversations: [],
      completedTodayByStaff: 2,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('kpi-strip')).toBeInTheDocument();
    });
  });

  it('does not show KPI strip for admin mode', async () => {
    mockMode = 'admin';
    mockDashboard();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('kpi-strip')).not.toBeInTheDocument();
  });

  it('shows My Work section for agent mode', async () => {
    mockMode = 'agent';
    mockDashboard({
      ...baseDashboardData,
      myBookingsToday: [
        {
          id: 'mb1',
          customer: { name: 'AgentClient' },
          service: { name: 'Consult' },
          startTime: '2026-02-17T09:00:00Z',
          status: 'CONFIRMED',
        },
      ],
      myAssignedConversations: [
        { id: 'mc1', customer: { name: 'ChatClient' }, messages: [{ content: 'Hello' }] },
      ],
      completedTodayByStaff: 1,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('my-work')).toBeInTheDocument();
      expect(screen.getByText('AgentClient')).toBeInTheDocument();
      expect(screen.getByText('ChatClient')).toBeInTheDocument();
    });
  });

  it('does not show My Work for admin mode', async () => {
    mockMode = 'admin';
    mockDashboard();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('my-work')).not.toBeInTheDocument();
  });

  it('hides admin-only sections for agent mode', async () => {
    mockMode = 'agent';
    mockDashboard({
      ...baseDashboardData,
      goLiveChecklist: {
        allComplete: false,
        items: [{ key: 'business_name', done: false, fixUrl: '/settings' }],
      },
      milestoneProgress: { completedBookings: 3, currentNudge: null, dismissedNudges: [] },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    // Go-live and milestone only shown in admin mode
    expect(screen.queryByText('dashboard.go_live_title')).not.toBeInTheDocument();
    expect(screen.queryByText('dashboard.milestone_title')).not.toBeInTheDocument();
  });

  it('shows today schedule for agent mode', async () => {
    mockMode = 'agent';
    mockDashboard({
      ...baseDashboardData,
      todayBookings: [
        {
          id: 'b1',
          customer: { name: 'Schedule Person' },
          service: { name: 'Botox' },
          staff: null,
          startTime: '2026-02-17T10:00:00Z',
          status: 'CONFIRMED',
        },
      ],
      myBookingsToday: [],
      myAssignedConversations: [],
      completedTodayByStaff: 0,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('today-schedule')).toBeInTheDocument();
      expect(screen.getByText('Schedule Person')).toBeInTheDocument();
    });
  });

  it('does not show today schedule for provider mode', async () => {
    mockMode = 'provider';
    mockDashboard({
      ...baseDashboardData,
      todayBookings: [
        {
          id: 'b1',
          customer: { name: 'Test' },
          service: { name: 'Test' },
          staff: null,
          startTime: '2026-02-17T10:00:00Z',
          status: 'CONFIRMED',
        },
      ],
      myBookingsToday: [],
      myAssignedConversations: [],
      completedTodayByStaff: 0,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('today-schedule')).not.toBeInTheDocument();
  });

  // ─── All sections combined ──────────────────────────────────

  it('renders full dashboard with all sections', async () => {
    mockDashboard({
      metrics: baseMetrics,
      statusBreakdown: [
        { status: 'CONFIRMED', count: 4 },
        { status: 'PENDING', count: 2 },
      ],
      todayBookings: [
        {
          id: 'b1',
          customer: { name: 'Today Patient' },
          service: { name: 'Checkup', kind: 'CONSULT' },
          staff: { name: 'Dr. X' },
          startTime: '2026-02-16T10:00:00Z',
          status: 'CONFIRMED',
        },
      ],
      unassignedConversations: [
        {
          id: 'c1',
          customer: { name: 'Unassigned Person' },
          messages: [{ content: 'When can I come in?' }],
          lastMessageAt: new Date(Date.now() - 600000).toISOString(),
        },
      ],
      attentionNeeded: {
        depositPendingBookings: [
          { id: 'dp1', customer: { name: 'Deposit Needed' }, service: { name: 'Botox' } },
        ],
        overdueConversations: [],
        tomorrowBookings: [],
      },
      goLiveChecklist: {
        allComplete: false,
        items: [
          { key: 'business_name', done: true },
          { key: 'first_booking', done: false, fixUrl: '/bookings' },
        ],
      },
      milestoneProgress: {
        completedBookings: 5,
        currentNudge: {
          id: 'nudge_5',
          link: '/bookings',
        },
        dismissedNudges: [],
      },
      consultConversion: { rate: 55, converted: 11, consultCustomers: 20 },
      waitlistMetrics: {
        totalEntries: 18,
        offers: 14,
        claimed: 11,
        fillRate: 78,
        avgTimeToFill: 22,
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      // Title
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
      // Metric cards
      expect(screen.getByText('dashboard.bookings_this_week')).toBeInTheDocument();
      expect(screen.getByText('dashboard.revenue_30d')).toBeInTheDocument();
      // Today appointments
      expect(screen.getByText('Today Patient')).toBeInTheDocument();
      // Unassigned
      expect(screen.getByText('Unassigned Person')).toBeInTheDocument();
      // Attention
      expect(screen.getByText('dashboard.attention_needed')).toBeInTheDocument();
      expect(screen.getByText('Deposit Needed')).toBeInTheDocument();
      // Checklist
      expect(screen.getByText('dashboard.go_live_title')).toBeInTheDocument();
      // Milestone
      expect(screen.getByText('dashboard.milestone_title')).toBeInTheDocument();
      // Consult conversion
      expect(screen.getByText('55%')).toBeInTheDocument();
      // Waitlist
      expect(screen.getByText('Waitlist Backfill')).toBeInTheDocument();
      expect(screen.getByText('78%')).toBeInTheDocument();
    });
  });

  // ─── Dashboard Pinned Views ──────────────────────────────

  it('fetches dashboard views on mount', async () => {
    mockDashboard();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/saved-views/dashboard');
    });
  });

  it('renders dashboard view cards when views exist', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/business') {
        return Promise.resolve({ packConfig: { setupComplete: true } });
      }
      if (path === '/dashboard') {
        return Promise.resolve(baseDashboardData);
      }
      if (path === '/saved-views/dashboard') {
        return Promise.resolve([
          { id: 'v1', name: 'Pending Deposits', page: 'bookings', icon: 'flag', isDashboard: true },
          { id: 'v2', name: 'Overdue Replies', page: 'inbox', icon: 'bell', isDashboard: true },
        ]);
      }
      return Promise.resolve({});
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Pending Deposits')).toBeInTheDocument();
    expect(screen.getByText('Overdue Replies')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-views')).toBeInTheDocument();
  });

  it('navigates to page with viewId when dashboard view card clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/business') {
        return Promise.resolve({ packConfig: { setupComplete: true } });
      }
      if (path === '/dashboard') {
        return Promise.resolve(baseDashboardData);
      }
      if (path === '/saved-views/dashboard') {
        return Promise.resolve([
          { id: 'v1', name: 'Pending Deposits', page: 'bookings', icon: 'flag', isDashboard: true },
        ]);
      }
      return Promise.resolve({});
    });

    render(<DashboardPage />);

    const card = await screen.findByText('Pending Deposits');
    await act(async () => {
      await user.click(card.closest('button')!);
    });

    expect(mockPush).toHaveBeenCalledWith('/bookings?viewId=v1');
  });

  it('hides dashboard views section when no views', async () => {
    mockDashboard();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.title')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('dashboard-views')).not.toBeInTheDocument();
  });
});

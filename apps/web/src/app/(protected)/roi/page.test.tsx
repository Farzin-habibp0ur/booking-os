import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoiPage from './page';

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
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
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

// Mock recharts
jest.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ReferenceLine: () => <div data-testid="reference-line" />,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  TrendingUp: (props: any) => <div data-testid="trending-up-icon" {...props} />,
  ChevronDown: (props: any) => <div data-testid="chevron-down-icon" {...props} />,
  ChevronUp: (props: any) => <div data-testid="chevron-up-icon" {...props} />,
  Rocket: (props: any) => <div data-testid="rocket-icon" {...props} />,
  Mail: (props: any) => <div data-testid="mail-icon" {...props} />,
  Loader2: (props: any) => <div data-testid="loader-icon" {...props} />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const baseDashboardData = {
  hasBaseline: true,
  baseline: {
    goLiveDate: '2026-01-01T00:00:00Z',
    baselineStart: '2025-12-01T00:00:00Z',
    baselineEnd: '2025-12-31T00:00:00Z',
    metrics: { noShowRate: 15 },
  },
  current: {
    noShowRate: 8,
    noShowTotal: 4,
    consultConversionRate: 60,
    avgResponseMinutes: 5,
    totalRevenue: 25000,
    completedBookings: 50,
    depositCompliance: 85,
    revenueOverTime: [
      { date: '2026-01-15', revenue: 800 },
      { date: '2026-01-16', revenue: 1200 },
    ],
    statusBreakdown: [
      { status: 'CONFIRMED', count: 30 },
      { status: 'CANCELLED', count: 5 },
    ],
  },
  deltas: {
    noShowRate: -7,
    consultConversionRate: 10,
    avgResponseMinutes: -3,
    totalRevenue: 5000,
  },
  recoveredRevenue: {
    amount: 3500,
    sufficient: true,
    reason: null,
    formula: {
      baselineNoShowRate: 15,
      currentNoShowRate: 8,
      noShowImprovement: 7,
      completedBookings: 50,
      avgBookingValue: 500,
    },
  },
};

const weeklyReviewData = {
  thisWeek: {
    noShowRate: 5,
    consultConversionRate: 65,
    avgResponseMinutes: 4,
    totalRevenue: 8000,
    completedBookings: 20,
    depositCompliance: 90,
  },
  lastWeek: {
    noShowRate: 8,
    consultConversionRate: 55,
    avgResponseMinutes: 7,
    totalRevenue: 6000,
    completedBookings: 15,
    depositCompliance: 80,
  },
  weekDelta: {
    noShowRate: -3,
    consultConversionRate: 10,
    avgResponseMinutes: -3,
    totalRevenue: 2000,
    completedBookings: 5,
    depositCompliance: 10,
  },
  weekNumber: 3,
  dateRange: { start: '2026-02-10', end: '2026-02-16' },
  generatedAt: '2026-02-16T18:00:00Z',
};

describe('RoiPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Loading State ──────────────────────────────────────────

  it('shows loading skeleton while fetching initial data', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));

    render(<RoiPage />);

    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
  });

  // ─── No Baseline (Go Live CTA) ─────────────────────────────

  it('shows go-live CTA when no baseline exists', async () => {
    mockApi.get.mockResolvedValue({ hasBaseline: false });

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.go_live_title')).toBeInTheDocument();
      expect(screen.getByText('roi.go_live_description')).toBeInTheDocument();
      expect(screen.getByText('roi.go_live_button')).toBeInTheDocument();
    });
  });

  it('calls go-live API when button is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ hasBaseline: false });
    mockApi.post.mockResolvedValue({});

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.go_live_button')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('roi.go_live_button'));
    });

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/roi/go-live');
    });
  });

  // ─── Dashboard Tab ─────────────────────────────────────────

  it('renders dashboard with title and period selector', async () => {
    mockApi.get.mockResolvedValue(baseDashboardData);

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.title')).toBeInTheDocument();
      expect(screen.getByText('roi.period_7d')).toBeInTheDocument();
      expect(screen.getByText('roi.period_30d')).toBeInTheDocument();
      expect(screen.getByText('roi.period_90d')).toBeInTheDocument();
    });
  });

  it('renders tab buttons for dashboard and weekly', async () => {
    mockApi.get.mockResolvedValue(baseDashboardData);

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.tab_dashboard')).toBeInTheDocument();
      expect(screen.getByText('roi.tab_weekly')).toBeInTheDocument();
    });
  });

  it('displays metric cards with current values', async () => {
    mockApi.get.mockResolvedValue(baseDashboardData);

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('8%')).toBeInTheDocument(); // noShowRate
      expect(screen.getByText('5m')).toBeInTheDocument(); // avgResponseMinutes
      expect(screen.getByText('60%')).toBeInTheDocument(); // consultConversionRate
      expect(screen.getByText('85%')).toBeInTheDocument(); // depositCompliance
      expect(screen.getByText('50')).toBeInTheDocument(); // completedBookings
    });
  });

  it('displays metric card labels', async () => {
    mockApi.get.mockResolvedValue(baseDashboardData);

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.no_show_rate')).toBeInTheDocument();
      expect(screen.getByText('roi.avg_response')).toBeInTheDocument();
      expect(screen.getByText('roi.consult_conversion')).toBeInTheDocument();
      expect(screen.getByText('roi.revenue')).toBeInTheDocument();
      expect(screen.getByText('roi.completed_bookings')).toBeInTheDocument();
    });
  });

  it('displays recovered revenue amount', async () => {
    mockApi.get.mockResolvedValue(baseDashboardData);

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.recovered_revenue_title')).toBeInTheDocument();
      expect(screen.getByText('$3,500')).toBeInTheDocument();
    });
  });

  it('shows insufficient data message when recovered revenue has no amount', async () => {
    mockApi.get.mockResolvedValue({
      ...baseDashboardData,
      recoveredRevenue: {
        amount: null,
        sufficient: false,
        reason: 'insufficient_data',
        formula: null,
      },
    });

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.insufficient_data')).toBeInTheDocument();
      expect(screen.getByText('roi.insufficient_data_desc')).toBeInTheDocument();
    });
  });

  it('toggles formula explanation when how-we-calculate button is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue(baseDashboardData);

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.how_we_calculate')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('roi.how_we_calculate'));
    });

    await waitFor(() => {
      expect(screen.getByText('roi.formula_explanation')).toBeInTheDocument();
    });
  });

  it('renders trend charts', async () => {
    mockApi.get.mockResolvedValue(baseDashboardData);

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.no_show_trend')).toBeInTheDocument();
      expect(screen.getByText('roi.revenue_trend')).toBeInTheDocument();
      const charts = screen.getAllByTestId('area-chart');
      expect(charts.length).toBe(2);
    });
  });

  it('changes period when period button is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue(baseDashboardData);

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.title')).toBeInTheDocument();
    });

    // Default is 30 days - click 7d
    await act(async () => {
      await user.click(screen.getByText('roi.period_7d'));
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/roi/dashboard?days=7');
    });
  });

  // ─── Weekly Tab ────────────────────────────────────────────

  it('switches to weekly tab and loads weekly review data', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/roi/dashboard')) return Promise.resolve(baseDashboardData);
      if (path === '/roi/weekly-review') return Promise.resolve(weeklyReviewData);
      return Promise.resolve({});
    });

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.tab_weekly')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('roi.tab_weekly'));
    });

    await waitFor(() => {
      expect(screen.getByText('roi.weekly_title')).toBeInTheDocument();
      expect(screen.getByText('roi.email_review')).toBeInTheDocument();
    });
  });

  it('shows no weekly data message when weekly review is null', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/roi/dashboard')) return Promise.resolve(baseDashboardData);
      if (path === '/roi/weekly-review') return Promise.reject(new Error('No data'));
      return Promise.resolve({});
    });

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.tab_weekly')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('roi.tab_weekly'));
    });

    await waitFor(() => {
      expect(screen.getByText('roi.no_weekly_data')).toBeInTheDocument();
    });
  });

  it('sends email review when button is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/roi/dashboard')) return Promise.resolve(baseDashboardData);
      if (path === '/roi/weekly-review') return Promise.resolve(weeklyReviewData);
      return Promise.resolve({});
    });
    mockApi.post.mockResolvedValue({});

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.tab_weekly')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('roi.tab_weekly'));
    });

    await waitFor(() => {
      expect(screen.getByText('roi.email_review')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('roi.email_review'));
    });

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/roi/email-review');
    });

    expect(mockToast).toHaveBeenCalledWith('roi.email_sent');
  });

  // ─── Baseline Banner ───────────────────────────────────────

  it('renders baseline banner with go-live date', async () => {
    mockApi.get.mockResolvedValue(baseDashboardData);

    render(<RoiPage />);

    await waitFor(() => {
      expect(screen.getByText('roi.baseline_banner')).toBeInTheDocument();
    });
  });

  // ─── API Calls ─────────────────────────────────────────────

  it('calls dashboard API with default 30-day period on mount', async () => {
    mockApi.get.mockResolvedValue(baseDashboardData);

    render(<RoiPage />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/roi/dashboard?days=30');
    });
  });
});

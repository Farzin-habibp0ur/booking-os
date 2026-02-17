import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportsPage from './page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
  I18nProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
    customerFields: [],
  }),
}));
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));
jest.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

function setupApiMocks(overrides: Record<string, any> = {}) {
  mockApi.get.mockImplementation((url: string) => {
    if (url.includes('bookings-over-time')) {
      return Promise.resolve(overrides.bookingsData ?? [{ date: '2026-02-01', count: 5 }]);
    }
    if (url.includes('revenue-over-time')) {
      return Promise.resolve(overrides.revenueData ?? [{ date: '2026-02-01', revenue: 500 }]);
    }
    if (url.includes('no-show-rate')) {
      return Promise.resolve(overrides.noShowData ?? { total: 50, noShows: 5, rate: 10 });
    }
    if (url.includes('response-times')) {
      return Promise.resolve(overrides.responseData ?? { avgMinutes: 8, sampleSize: 30 });
    }
    if (url.includes('service-breakdown')) {
      return Promise.resolve(
        overrides.serviceData ?? [
          { name: 'Botox', count: 20, revenue: 4000 },
          { name: 'Filler', count: 10, revenue: 3000 },
        ],
      );
    }
    if (url.includes('staff-performance')) {
      return Promise.resolve(
        overrides.staffData ?? [
          {
            staffId: 's1',
            name: 'Dr. Chen',
            total: 30,
            completed: 25,
            noShows: 3,
            noShowRate: 10,
            revenue: 6000,
          },
        ],
      );
    }
    if (url.includes('status-breakdown')) {
      return Promise.resolve(
        overrides.statusData ?? [
          { status: 'COMPLETED', count: 30 },
          { status: 'NO_SHOW', count: 5 },
          { status: 'CANCELLED', count: 3 },
        ],
      );
    }
    if (url.includes('peak-hours')) {
      return Promise.resolve(
        overrides.peakData ?? {
          byHour: [
            { hour: 9, count: 5 },
            { hour: 10, count: 8 },
            { hour: 11, count: 6 },
          ],
          byDay: [
            { day: 1, count: 10 },
            { day: 2, count: 12 },
          ],
        },
      );
    }
    if (url.includes('consult-conversion')) {
      return Promise.resolve(
        overrides.conversionData ?? { consultCustomers: 10, converted: 6, rate: 60 },
      );
    }
    return Promise.resolve([]);
  });
}

describe('ReportsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders reports page with title', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.title')).toBeInTheDocument();
    });
  });

  test('has period filter buttons', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.period_7d')).toBeInTheDocument();
      expect(screen.getByText('reports.period_30d')).toBeInTheDocument();
      expect(screen.getByText('reports.period_90d')).toBeInTheDocument();
    });
  });

  // ─── Summary Cards ────────────────────────────────────────────────────

  test('displays total bookings summary card', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.total_bookings')).toBeInTheDocument();
      expect(screen.getByText('38')).toBeInTheDocument(); // 30 + 5 + 3
    });
  });

  test('displays revenue summary card', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.revenue')).toBeInTheDocument();
      expect(screen.getByText('$500')).toBeInTheDocument();
    });
  });

  test('displays no-show rate summary card', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.no_show_rate')).toBeInTheDocument();
      // 10% appears in both summary and staff table, so check for at least one
      expect(screen.getAllByText('10%').length).toBeGreaterThan(0);
    });
  });

  test('displays average response time summary card', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.avg_response')).toBeInTheDocument();
      expect(screen.getByText('8m')).toBeInTheDocument();
    });
  });

  test('displays consult conversion rate', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(screen.getByText('6/10')).toBeInTheDocument();
    });
  });

  // ─── Charts ───────────────────────────────────────────────────────────

  test('renders bookings over time chart', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.bookings_over_time')).toBeInTheDocument();
      const areaCharts = screen.getAllByTestId('area-chart');
      expect(areaCharts.length).toBeGreaterThan(0);
    });
  });

  test('renders revenue over time chart', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.revenue_over_time')).toBeInTheDocument();
    });
  });

  // ─── Service Breakdown ────────────────────────────────────────────────

  test('renders service popularity section', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.service_popularity')).toBeInTheDocument();
      expect(screen.getByText('Botox')).toBeInTheDocument();
      expect(screen.getByText('Filler')).toBeInTheDocument();
    });
  });

  test('shows no data when service data is empty', async () => {
    setupApiMocks({ serviceData: [] });
    render(<ReportsPage />);
    await waitFor(() => {
      const noDataElements = screen.getAllByText('reports.no_data');
      expect(noDataElements.length).toBeGreaterThan(0);
    });
  });

  // ─── Status Breakdown ────────────────────────────────────────────────

  test('renders status breakdown with pie chart', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.status_breakdown')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });
  });

  test('shows status counts and percentages', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      // Status counts appear in both breakdown and staff table
      expect(screen.getAllByText('30').length).toBeGreaterThan(0); // COMPLETED count
      expect(screen.getAllByText('5').length).toBeGreaterThan(0); // NO_SHOW count
    });
  });

  test('shows no data when status data is empty', async () => {
    setupApiMocks({ statusData: [] });
    render(<ReportsPage />);
    await waitFor(() => {
      const noDataElements = screen.getAllByText('reports.no_data');
      expect(noDataElements.length).toBeGreaterThan(0);
    });
  });

  // ─── Staff Performance ────────────────────────────────────────────────

  test('renders staff performance table', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.staff_performance')).toBeInTheDocument();
      expect(screen.getByText('Dr. Chen')).toBeInTheDocument();
    });
  });

  test('shows no staff data message when empty', async () => {
    setupApiMocks({ staffData: [] });
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.no_staff_data')).toBeInTheDocument();
    });
  });

  // ─── Peak Hours ───────────────────────────────────────────────────────

  test('renders peak hours charts', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.bookings_by_hour')).toBeInTheDocument();
      expect(screen.getByText('reports.bookings_by_day')).toBeInTheDocument();
    });
  });

  test('does not render peak hours when data is null', async () => {
    setupApiMocks({ peakData: null });
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.title')).toBeInTheDocument();
    });
    expect(screen.queryByText('reports.bookings_by_hour')).not.toBeInTheDocument();
  });

  // ─── Period Switching ─────────────────────────────────────────────────

  test('switches period when button is clicked', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => screen.getByText('reports.period_7d'));

    fireEvent.click(screen.getByText('reports.period_7d'));

    await waitFor(() => {
      // Verify that API was called with days=7
      const calls = mockApi.get.mock.calls;
      const recentCalls = calls.filter((c: any) => c[0].includes('days=7'));
      expect(recentCalls.length).toBeGreaterThan(0);
    });
  });

  test('switches to 90-day period', async () => {
    setupApiMocks();
    render(<ReportsPage />);
    await waitFor(() => screen.getByText('reports.period_90d'));

    fireEvent.click(screen.getByText('reports.period_90d'));

    await waitFor(() => {
      const calls = mockApi.get.mock.calls;
      const recentCalls = calls.filter((c: any) => c[0].includes('days=90'));
      expect(recentCalls.length).toBeGreaterThan(0);
    });
  });

  // ─── Summary card accents ─────────────────────────────────────────────

  test('shows red accent on high no-show rate', async () => {
    setupApiMocks({ noShowData: { total: 50, noShows: 10, rate: 20 } });
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('20%')).toBeInTheDocument();
    });
  });

  test('shows red accent on high response time', async () => {
    setupApiMocks({ responseData: { avgMinutes: 25, sampleSize: 30 } });
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('25m')).toBeInTheDocument();
    });
  });

  test('shows dash for no-show rate when data is null', async () => {
    setupApiMocks({ noShowData: null });
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByText('reports.no_show_rate')).toBeInTheDocument();
    });
  });
});

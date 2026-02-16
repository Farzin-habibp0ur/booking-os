import { render, screen, waitFor } from '@testing-library/react';
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
    user: { id: '1', name: 'Sarah', role: 'OWNER', businessId: 'b1' },
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

describe('ReportsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders reports page with title', async () => {
    mockApi.get.mockResolvedValue([]);

    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('reports.title')).toBeInTheDocument();
    });
  });

  test('has period filter buttons', async () => {
    mockApi.get.mockResolvedValue([]);

    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('reports.period_7d')).toBeInTheDocument();
      expect(screen.getByText('reports.period_30d')).toBeInTheDocument();
      expect(screen.getByText('reports.period_90d')).toBeInTheDocument();
    });
  });

  test('displays summary cards', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('by-status')) {
        return Promise.resolve([{ status: 'COMPLETED', count: 10 }]);
      }
      if (url.includes('revenue')) {
        return Promise.resolve([{ date: '2026-01-01', revenue: 500 }]);
      }
      return Promise.resolve([]);
    });

    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('reports.total_bookings')).toBeInTheDocument();
      expect(screen.getByText('reports.revenue')).toBeInTheDocument();
    });
  });

  test('shows no data message when empty', async () => {
    mockApi.get.mockResolvedValue([]);

    render(<ReportsPage />);

    await waitFor(() => {
      // Both service and status sections show no_data when empty
      const noDataElements = screen.getAllByText('reports.no_data');
      expect(noDataElements.length).toBeGreaterThan(0);
    });
  });
});

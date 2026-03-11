jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue([]),
    post: jest.fn().mockResolvedValue({}),
    patch: jest.fn().mockResolvedValue({}),
    del: jest.fn().mockResolvedValue({}),
    getText: jest.fn().mockResolvedValue(''),
  },
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Area: () => null,
  Bar: () => null,
  Line: () => null,
  Pie: ({ children }: any) => <div>{children}</div>,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

jest.mock('@/components/skeleton', () => ({
  EmptyState: ({ title }: any) => <div data-testid="empty-state">{title}</div>,
}));

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportsPage from './page';
import { api } from '@/lib/api';

const mockRevenueSummary = {
  totalRevenue: 5000,
  bookingCount: 50,
  avgPerBooking: 100,
  revenueChange: 15,
  byService: [
    { name: 'Consultation', revenue: 3000, count: 30 },
    { name: 'Treatment', revenue: 2000, count: 20 },
  ],
  byStaff: [
    { name: 'Dr. Smith', revenue: 3000, count: 30 },
    { name: 'Dr. Jones', revenue: 2000, count: 20 },
  ],
};

const mockStaffUtilization = [
  {
    staffId: 'st1',
    name: 'Dr. Smith',
    totalBookings: 30,
    completed: 25,
    noShows: 2,
    bookedHours: 60,
    availableHours: 80,
    utilization: 75,
  },
];

const mockClientMetrics = {
  totalCustomers: 200,
  newCustomers: 15,
  returningCustomers: 10,
  newBookingCustomers: 5,
  retentionRate: 67,
  topClients: [
    { name: 'Alice Johnson', email: 'alice@test.com', revenue: 1200, visits: 8 },
    { name: 'Bob Williams', email: 'bob@test.com', revenue: 800, visits: 5 },
  ],
};

const mockCommMetrics = {
  totalConversations: 50,
  totalMessages: 200,
  avgResponseMinutes: 8,
  slaRate: 92,
  responseTimeTrend: [
    { date: '2026-03-01', avgMinutes: 10 },
    { date: '2026-03-02', avgMinutes: 7 },
  ],
};

describe('ReportsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/reports/revenue-summary')) return Promise.resolve(mockRevenueSummary);
      if (url.includes('/reports/staff-utilization')) return Promise.resolve(mockStaffUtilization);
      if (url.includes('/reports/client-metrics')) return Promise.resolve(mockClientMetrics);
      if (url.includes('/reports/communication-metrics')) return Promise.resolve(mockCommMetrics);
      if (url.includes('/reports/status-breakdown'))
        return Promise.resolve([
          { status: 'COMPLETED', count: 30 },
          { status: 'CANCELLED', count: 5 },
        ]);
      if (url.includes('/reports/revenue-over-time'))
        return Promise.resolve([{ date: '2026-03-01', revenue: 500 }]);
      if (url.includes('/reports/bookings-over-time'))
        return Promise.resolve([{ date: '2026-03-01', count: 10 }]);
      if (url.includes('/reports/no-show-rate'))
        return Promise.resolve({ rate: 8, total: 50, noShows: 4 });
      if (url.includes('/reports/service-breakdown'))
        return Promise.resolve([{ name: 'Consult', count: 10, revenue: 1000 }]);
      if (url.includes('/reports/staff-performance'))
        return Promise.resolve([
          {
            staffId: 'st1',
            name: 'Dr. Smith',
            total: 30,
            completed: 25,
            noShows: 2,
            noShowRate: 7,
            revenue: 3000,
          },
        ]);
      if (url.includes('/reports/peak-hours'))
        return Promise.resolve({ byHour: [], byDay: [] });
      if (url.includes('/reports/consult-conversion'))
        return Promise.resolve({ rate: 45, converted: 9, consultCustomers: 20 });
      if (url.includes('/reports/source-breakdown'))
        return Promise.resolve([{ source: 'MANUAL', count: 10, completed: 8 }]);
      if (url.includes('/reports/schedules')) return Promise.resolve([]);
      if (url.includes('/staff'))
        return Promise.resolve([{ id: 'st1', name: 'Dr. Smith' }]);
      return Promise.resolve({});
    });
  });

  it('renders page title', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });
    expect(screen.getByText('reports.title')).toBeInTheDocument();
  });

  it('renders date range picker with This Month default', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });
    expect(screen.getByText('This Month')).toBeInTheDocument();
  });

  it('opens date range picker with presets on click', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    fireEvent.click(screen.getByText('This Month'));

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('This Week')).toBeInTheDocument();
      expect(screen.getByText('Last Month')).toBeInTheDocument();
      expect(screen.getByText('Last Quarter')).toBeInTheDocument();
      expect(screen.getByText('Custom Range')).toBeInTheDocument();
    });
  });

  it('renders staff filter dropdown', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Filter by staff')).toBeInTheDocument();
    });
  });

  it('renders section tabs', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
  });

  it('shows revenue section by default with summary cards', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('Completed Bookings')).toBeInTheDocument();
      expect(screen.getByText('Avg. per Booking')).toBeInTheDocument();
    });
  });

  it('shows revenue by service breakdown', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Revenue by Service')).toBeInTheDocument();
      expect(screen.getByText('Consultation')).toBeInTheDocument();
    });
  });

  it('shows revenue change indicator', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    await waitFor(() => {
      expect(screen.getAllByText('15%').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('switches to bookings section', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    fireEvent.click(screen.getByText('Bookings'));

    await waitFor(() => {
      expect(screen.getByText('reports.bookings_over_time')).toBeInTheDocument();
      expect(screen.getByText('reports.status_breakdown')).toBeInTheDocument();
      expect(screen.getByText('Booking Sources')).toBeInTheDocument();
    });
  });

  it('switches to staff section with utilization', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    fireEvent.click(screen.getByText('Staff'));

    await waitFor(() => {
      expect(screen.getByText('Staff Utilization')).toBeInTheDocument();
      expect(screen.getByText('reports.staff_performance')).toBeInTheDocument();
    });
  });

  it('shows utilization percentage for staff', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    fireEvent.click(screen.getByText('Staff'));

    await waitFor(() => {
      expect(screen.getByText(/60h \/ 80h · 75%/)).toBeInTheDocument();
    });
  });

  it('switches to communication section', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    fireEvent.click(screen.getByText('Communication'));

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument();
      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByText('SLA Compliance')).toBeInTheDocument();
      expect(screen.getByText('Response Time Trend')).toBeInTheDocument();
    });
  });

  it('shows SLA rate in communication section', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    fireEvent.click(screen.getByText('Communication'));

    await waitFor(() => {
      expect(screen.getByText('92%')).toBeInTheDocument();
    });
  });

  it('switches to clients section', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    fireEvent.click(screen.getByText('Clients'));

    await waitFor(() => {
      expect(screen.getByText('Total Customers')).toBeInTheDocument();
      expect(screen.getByText('New Customers')).toBeInTheDocument();
      expect(screen.getByText('Returning')).toBeInTheDocument();
      expect(screen.getByText('Retention Rate')).toBeInTheDocument();
    });
  });

  it('shows top clients table', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    fireEvent.click(screen.getByText('Clients'));

    await waitFor(() => {
      expect(screen.getByText('Top Clients by Revenue')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Bob Williams')).toBeInTheDocument();
    });
  });

  it('shows new vs returning chart', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    fireEvent.click(screen.getByText('Clients'));

    await waitFor(() => {
      expect(screen.getByText('New vs Returning')).toBeInTheDocument();
    });
  });

  it('shows monthly review link', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });
    expect(screen.getByText('Monthly Business Review')).toBeInTheDocument();
  });

  it('renders Schedule Email button and opens modal', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    fireEvent.click(screen.getByText('Schedule Email'));
    expect(screen.getByText('Schedule Report Email')).toBeInTheDocument();
  });

  it('shows Scheduled badge when schedules exist', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/schedules')) return Promise.resolve([{ id: 'rs-1' }, { id: 'rs-2' }]);
      if (url.includes('/reports/revenue-summary')) return Promise.resolve(mockRevenueSummary);
      if (url.includes('/reports/communication-metrics')) return Promise.resolve(mockCommMetrics);
      if (url.includes('/reports/no-show-rate')) return Promise.resolve({ rate: 10 });
      if (url.includes('/reports/consult-conversion')) return Promise.resolve({ rate: 50 });
      if (url.includes('/reports/peak-hours')) return Promise.resolve({ byHour: [], byDay: [] });
      if (url.includes('/staff')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    await act(async () => {
      render(<ReportsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('2 Scheduled')).toBeInTheDocument();
    });
  });

  it('fetches data with from/to date params', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('from='));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('to='));
    });
  });

  it('renders summary cards with correct values', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('reports.total_bookings')).toBeInTheDocument();
      expect(screen.getByText('reports.revenue')).toBeInTheDocument();
      expect(screen.getByText('reports.no_show_rate')).toBeInTheDocument();
    });
  });

  it('submits schedule form', async () => {
    (api.post as jest.Mock).mockResolvedValue({ id: 'rs-new' });

    await act(async () => {
      render(<ReportsPage />);
    });

    fireEvent.click(screen.getByText('Schedule Email'));

    const recipientInput = screen.getByPlaceholderText('admin@clinic.com, manager@clinic.com');
    fireEvent.change(recipientInput, { target: { value: 'test@test.com' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Schedule'));
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/reports/schedules',
        expect.objectContaining({
          reportType: 'bookings-over-time',
          frequency: 'WEEKLY',
          recipients: ['test@test.com'],
          dayOfWeek: 1,
          hour: 9,
        }),
      );
    });
  });
});

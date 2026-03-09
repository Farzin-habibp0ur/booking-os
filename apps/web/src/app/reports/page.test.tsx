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

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => null,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: ({ children }: any) => <div>{children}</div>,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ReportsPage from './page';
import { api } from '@/lib/api';

describe('ReportsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/schedules')) return Promise.resolve([]);
      if (url.includes('no-show-rate')) return Promise.resolve({ total: 10, noShows: 2, rate: 20 });
      if (url.includes('response-times')) return Promise.resolve({ avgMinutes: 5, sampleSize: 10 });
      if (url.includes('consult-conversion'))
        return Promise.resolve({ consultCustomers: 10, converted: 5, rate: 50 });
      if (url.includes('peak-hours')) return Promise.resolve({ byHour: [], byDay: [] });
      return Promise.resolve([]);
    });
  });

  it('renders page title', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });
    expect(screen.getByText('reports.title')).toBeInTheDocument();
  });

  it('renders period selector buttons', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });
    expect(screen.getByText('reports.period_7d')).toBeInTheDocument();
    expect(screen.getByText('reports.period_30d')).toBeInTheDocument();
    expect(screen.getByText('reports.period_90d')).toBeInTheDocument();
  });

  it('renders Schedule Email button', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });
    expect(screen.getByText('Schedule Email')).toBeInTheDocument();
  });

  it('opens schedule modal on button click', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });
    fireEvent.click(screen.getByText('Schedule Email'));
    expect(screen.getByText('Schedule Report Email')).toBeInTheDocument();
  });

  it('schedule modal has report type and frequency selectors', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });
    fireEvent.click(screen.getByText('Schedule Email'));
    expect(screen.getByText('Report')).toBeInTheDocument();
    expect(screen.getByText('Frequency')).toBeInTheDocument();
  });

  it('shows Scheduled badge when schedules exist', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/schedules')) return Promise.resolve([{ id: 'rs-1' }, { id: 'rs-2' }]);
      if (url.includes('response-times')) return Promise.resolve({ avgMinutes: 5 });
      if (url.includes('no-show-rate')) return Promise.resolve({ rate: 10 });
      if (url.includes('consult-conversion')) return Promise.resolve({ rate: 50 });
      if (url.includes('peak-hours')) return Promise.resolve({ byHour: [], byDay: [] });
      return Promise.resolve([]);
    });

    await act(async () => {
      render(<ReportsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('2 Scheduled')).toBeInTheDocument();
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

  it('changes period when clicking 7 days', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    (api.get as jest.Mock).mockClear();

    await act(async () => {
      fireEvent.click(screen.getByText('reports.period_7d'));
    });

    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('days=7'));
  });

  it('renders summary cards', async () => {
    await act(async () => {
      render(<ReportsPage />);
    });

    expect(screen.getByText('reports.total_bookings')).toBeInTheDocument();
    expect(screen.getByText('reports.revenue')).toBeInTheDocument();
    expect(screen.getByText('reports.no_show_rate')).toBeInTheDocument();
    expect(screen.getByText('reports.avg_response')).toBeInTheDocument();
  });
});

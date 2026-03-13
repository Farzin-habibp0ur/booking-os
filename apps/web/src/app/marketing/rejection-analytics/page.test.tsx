const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('@/components/skeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton">Loading...</div>,
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

jest.mock('lucide-react', () => ({
  BarChart3: () => <span data-testid="bar-chart-icon" />,
  ArrowLeft: () => <span data-testid="arrow-left-icon" />,
  TrendingUp: () => <span data-testid="trending-up" />,
  TrendingDown: () => <span data-testid="trending-down" />,
  Minus: () => <span data-testid="minus-icon" />,
  ChevronLeft: () => <span data-testid="chevron-left" />,
  ChevronRight: () => <span data-testid="chevron-right" />,
  ChevronDown: () => <span data-testid="chevron-down" />,
  ChevronUp: () => <span data-testid="chevron-up" />,
  AlertTriangle: () => <span data-testid="alert-triangle" />,
  ShieldAlert: () => <span data-testid="shield-alert" />,
  Info: () => <span data-testid="info-icon" />,
}));

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { api } from '@/lib/api';
import RejectionAnalyticsPage from './page';

const mockApi = api as jest.Mocked<typeof api>;

const mockStats = {
  byGate: [
    { gate: 'GATE_1', count: 10 },
    { gate: 'GATE_2', count: 8 },
  ],
  byCode: [
    { code: 'R01', count: 15 },
    { code: 'R03', count: 12 },
    { code: 'R05', count: 7 },
  ],
  byAgent: [
    { agent: 'MKT_BLOG_WRITER', count: 20 },
    { agent: 'MKT_SOCIAL_CREATOR', count: 15 },
  ],
  bySeverity: [
    { severity: 'MINOR', count: 25 },
    { severity: 'MAJOR', count: 10 },
    { severity: 'CRITICAL', count: 3 },
  ],
};

const mockWeeklySummary = {
  totalThisWeek: 12,
  totalLastWeek: 8,
  changePercent: 50,
  mostCommonCode: 'R01',
  mostRejectedAgent: 'MKT_BLOG_WRITER',
  rejectionRate: 15,
  byCode: [{ code: 'R01', count: 5 }],
  byAgent: [{ agent: 'MKT_BLOG_WRITER', count: 7 }],
};

const mockLogs = {
  items: [
    {
      id: 'log-1',
      date: '2027-01-15T10:00:00Z',
      draftTitle: 'SEO Guide Draft',
      agentId: 'MKT_BLOG_WRITER',
      gate: 'GATE_2',
      rejectionCode: 'R03',
      severity: 'MAJOR',
      reason: 'Content quality below threshold',
    },
    {
      id: 'log-2',
      date: '2027-01-14T08:00:00Z',
      draftTitle: 'Social Post v2',
      agentId: 'MKT_SOCIAL_CREATOR',
      gate: 'GATE_1',
      rejectionCode: 'R01',
      severity: 'CRITICAL',
      reason: 'Contains factual error about product',
    },
  ],
  total: 2,
};

const mockAgentDetail = {
  agentType: 'MKT_BLOG_WRITER',
  recentTrend: 'up' as const,
  changePercent: 25,
  breakdown: [
    { code: 'R01', count: 5 },
    { code: 'R03', count: 3 },
  ],
  last30Days: 12,
  last60Days: 8,
};

function setupMocks() {
  mockApi.get.mockImplementation((url: string) => {
    if (url.startsWith('/rejection-analytics/stats')) return Promise.resolve(mockStats);
    if (url.startsWith('/rejection-analytics/weekly-summary')) return Promise.resolve(mockWeeklySummary);
    if (url.startsWith('/rejection-analytics/logs')) return Promise.resolve(mockLogs);
    if (url.startsWith('/rejection-analytics/agent/'))
      return Promise.resolve(mockAgentDetail);
    return Promise.resolve(null);
  });
}

describe('RejectionAnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));
    render(<RejectionAnalyticsPage />);
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
  });

  it('renders page title', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });
    expect(screen.getByText('Rejection Analytics')).toBeInTheDocument();
  });

  it('renders back link to marketing', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });
    expect(screen.getByText('Back to Marketing')).toBeInTheDocument();
  });

  it('renders filters bar', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });
    expect(screen.getByTestId('rejection-filters')).toBeInTheDocument();
  });

  it('renders 4 chart sections', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('chart-by-code')).toBeInTheDocument();
      expect(screen.getByTestId('chart-by-agent')).toBeInTheDocument();
      expect(screen.getByTestId('chart-trend')).toBeInTheDocument();
      expect(screen.getByTestId('agent-detail-panel')).toBeInTheDocument();
    });
  });

  it('renders rejection by code chart with title', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Rejections by Code')).toBeInTheDocument();
    });
  });

  it('renders rejection by agent chart with title', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Rejections by Agent')).toBeInTheDocument();
    });
  });

  it('renders weekly summary', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('weekly-summary')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument(); // totalThisWeek
    });
  });

  it('shows most common rejection code in summary', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => {
      const summary = screen.getByTestId('weekly-summary');
      expect(summary).toBeInTheDocument();
      expect(screen.getAllByText('R01').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders rejection log table', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('rejection-log-table')).toBeInTheDocument();
    });
  });

  it('renders log rows with data', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => {
      const rows = screen.getAllByTestId('rejection-log-row');
      expect(rows.length).toBe(2);
    });
    expect(screen.getByText('SEO Guide Draft')).toBeInTheDocument();
    expect(screen.getByText('Social Post v2')).toBeInTheDocument();
  });

  it('shows severity badges', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => {
      expect(screen.getAllByText('MAJOR').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('CRITICAL').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows agent names in log table', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Blog Writer').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Social Creator').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('expands log row to show reason on click', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => screen.getAllByTestId('rejection-log-row'));

    fireEvent.click(screen.getAllByTestId('rejection-log-row')[0]);

    await waitFor(() => {
      expect(screen.getByText('Content quality below threshold')).toBeInTheDocument();
    });
  });

  it('shows week-over-week comparison', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });
  });

  it('renders gate filter dropdown', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => screen.getByTestId('rejection-filters'));
    const gateSelect = screen.getByTestId('filter-gate');
    expect(gateSelect).toBeInTheDocument();
  });

  it('renders agent filter dropdown', async () => {
    setupMocks();
    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => screen.getByTestId('rejection-filters'));
    const agentSelect = screen.getByTestId('filter-agent');
    expect(agentSelect).toBeInTheDocument();
  });

  it('shows empty state when no data', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/rejection-analytics/stats')
        return Promise.resolve({ byGate: [], byCode: [], byAgent: [], bySeverity: [] });
      if (url === '/rejection-analytics/weekly-summary')
        return Promise.resolve(null);
      if (url.startsWith('/rejection-analytics/logs'))
        return Promise.resolve({ items: [], total: 0 });
      return Promise.resolve(null);
    });

    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('rejection-log-table')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<RejectionAnalyticsPage />);
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to load rejection data', 'error');
    });
  });
});

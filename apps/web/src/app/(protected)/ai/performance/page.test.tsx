const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
  },
}));
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));
jest.mock('recharts', () => {
  const Original = jest.requireActual('recharts');
  return {
    ...Original,
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AIPerformancePage from './page';

const mockAgentStats = {
  totalRuns: 150,
  byAgent: [
    { agentType: 'WAITLIST', _count: 50 },
    { agentType: 'RETENTION', _count: 40 },
    { agentType: 'DATA_HYGIENE', _count: 60 },
  ],
  byStatus: [
    { status: 'COMPLETED', _count: 130 },
    { status: 'FAILED', _count: 20 },
  ],
};

const mockAutoOverview = {
  totalRulesActive: 5,
  totalMessagesSent7d: 120,
  totalMessagesSkipped7d: 10,
  totalMessagesFailed7d: 5,
  deliveryRate: 96,
  topPerformingRule: { name: 'Booking Reminder', sentCount: 80 },
};

const mockTimeline = [
  { date: '2026-03-01', sent: 30, skipped: 2, failed: 1 },
  { date: '2026-03-02', sent: 45, skipped: 3, failed: 0 },
];

const mockByRule = [
  {
    ruleId: 'r1',
    ruleName: 'Booking Reminder',
    trigger: 'BOOKING_CREATED',
    sent: 80,
    skipped: 5,
    failed: 2,
  },
  {
    ruleId: 'r2',
    ruleName: 'Follow-up',
    trigger: 'BOOKING_UPCOMING',
    sent: 40,
    skipped: 5,
    failed: 3,
  },
];

describe('AIPerformancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/agent-runs/stats')) return Promise.resolve(mockAgentStats);
      if (url.includes('/automations/analytics/overview')) return Promise.resolve(mockAutoOverview);
      if (url.includes('/automations/analytics/timeline')) return Promise.resolve(mockTimeline);
      if (url.includes('/automations/analytics/by-rule')) return Promise.resolve(mockByRule);
      return Promise.resolve(null);
    });
  });

  it('renders KPI cards with agent run metrics', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('kpi-grid')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // Total Runs
      expect(screen.getByText('130')).toBeInTheDocument(); // Completed
      expect(screen.getByText('20')).toBeInTheDocument(); // Failed
      expect(screen.getByText('87%')).toBeInTheDocument(); // Success Rate (130/150)
    });
  });

  it('renders date range selector with 3 options', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('date-range-selector')).toBeInTheDocument();
      expect(screen.getByTestId('range-7')).toBeInTheDocument();
      expect(screen.getByTestId('range-30')).toBeInTheDocument();
      expect(screen.getByTestId('range-90')).toBeInTheDocument();
    });
  });

  it('renders inner tab bar with 3 tabs', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('perf-tab-bar')).toBeInTheDocument();
      expect(screen.getByTestId('tab-agents')).toBeInTheDocument();
      expect(screen.getByTestId('tab-automations')).toBeInTheDocument();
      expect(screen.getByTestId('tab-combined')).toBeInTheDocument();
    });
  });

  it('defaults to agents tab showing agent performance section', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('agent-performance-section')).toBeInTheDocument();
      expect(screen.queryByTestId('automation-analytics-section')).not.toBeInTheDocument();
    });
  });

  it('switches to automations tab', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => screen.getByTestId('perf-tab-bar'));

    fireEvent.click(screen.getByTestId('tab-automations'));

    await waitFor(() => {
      expect(screen.getByTestId('automation-analytics-section')).toBeInTheDocument();
      expect(screen.queryByTestId('agent-performance-section')).not.toBeInTheDocument();
    });
  });

  it('combined tab shows both sections', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => screen.getByTestId('perf-tab-bar'));

    fireEvent.click(screen.getByTestId('tab-combined'));

    await waitFor(() => {
      expect(screen.getByTestId('agent-performance-section')).toBeInTheDocument();
      expect(screen.getByTestId('automation-analytics-section')).toBeInTheDocument();
    });
  });

  it('renders agent comparison chart', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('agent-comparison-chart')).toBeInTheDocument();
    });
  });

  it('shows automation KPI grid when on automations tab', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => screen.getByTestId('perf-tab-bar'));

    fireEvent.click(screen.getByTestId('tab-automations'));

    await waitFor(() => {
      expect(screen.getByTestId('automation-kpi-grid')).toBeInTheDocument();
      expect(screen.getByText('Active Rules')).toBeInTheDocument();
      expect(screen.getByText('96%')).toBeInTheDocument(); // Delivery Rate
    });
  });

  it('does not render marketing-specific charts', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('kpi-grid')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('tier-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pillar-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rejection-gate-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ab-test-summary')).not.toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AIPerformancePage />);
    expect(screen.getByTestId('performance-loading')).toBeInTheDocument();
  });

  it('calls all analytics endpoints', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('kpi-grid')).toBeInTheDocument();
    });
    expect(mockGet).toHaveBeenCalledWith('/agent-runs/stats');
    expect(mockGet).toHaveBeenCalledWith('/automations/analytics/overview');
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('/automations/analytics/timeline'),
    );
    expect(mockGet).toHaveBeenCalledWith('/automations/analytics/by-rule');
    expect(mockGet).not.toHaveBeenCalledWith('/marketing-content/stats');
    expect(mockGet).not.toHaveBeenCalledWith('/rejection-analytics/stats');
  });
});

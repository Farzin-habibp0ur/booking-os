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

import { render, screen, waitFor } from '@testing-library/react';
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

describe('AIPerformancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/agent-runs/stats')) return Promise.resolve(mockAgentStats);
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

  it('renders agent comparison chart', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('agent-comparison-chart')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AIPerformancePage />);
    expect(screen.getByTestId('performance-loading')).toBeInTheDocument();
  });

  it('only calls agent-runs/stats API, not marketing endpoints', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('kpi-grid')).toBeInTheDocument();
    });
    expect(mockGet).toHaveBeenCalledWith('/agent-runs/stats');
    expect(mockGet).not.toHaveBeenCalledWith('/marketing-content/stats');
    expect(mockGet).not.toHaveBeenCalledWith('/rejection-analytics/stats');
    expect(mockGet).not.toHaveBeenCalledWith('/ab-testing');
  });
});

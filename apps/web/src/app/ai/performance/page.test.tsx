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
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  };
});

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AIPerformancePage from './page';

const mockPerformance = {
  totalRuns: 150,
  successfulRuns: 135,
  failedRuns: 15,
  successRate: 90,
  avgRunTime: 1250,
  dailyStats: [
    { date: 'Mar 1', successRate: 88, created: 10, approved: 8, dismissed: 2 },
    { date: 'Mar 2', successRate: 92, created: 12, approved: 10, dismissed: 1 },
  ],
  agentComparison: [
    { agentType: 'WAITLIST', runs: 50, successRate: 92, cardsCreated: 20 },
    { agentType: 'RETENTION', runs: 40, successRate: 85, cardsCreated: 15 },
  ],
};

const mockFeedback = [
  { agentType: 'WAITLIST', helpful: 25, notHelpful: 5, total: 30, helpfulPercent: 83.3 },
  { agentType: 'RETENTION', helpful: 10, notHelpful: 8, total: 18, helpfulPercent: 55.6 },
];

describe('AIPerformancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/agents/runs')) return Promise.resolve(mockPerformance);
      if (url.includes('/agents/feedback')) return Promise.resolve(mockFeedback);
      return Promise.resolve(null);
    });
  });

  it('renders KPI cards with metrics', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('kpi-grid')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // Total Runs
      expect(screen.getByText('135')).toBeInTheDocument(); // Successful
      expect(screen.getByText('15')).toBeInTheDocument(); // Failed
      expect(screen.getByText('90%')).toBeInTheDocument(); // Success Rate
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

  it('changes date range on click', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => screen.getByTestId('range-7'));

    fireEvent.click(screen.getByTestId('range-7'));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('days=7'));
    });
  });

  it('renders charts', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('success-rate-chart')).toBeInTheDocument();
      expect(screen.getByTestId('cards-chart')).toBeInTheDocument();
      expect(screen.getByTestId('agent-comparison-chart')).toBeInTheDocument();
    });
  });

  it('renders staff feedback table', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('feedback-table')).toBeInTheDocument();
      expect(screen.getByText('WAITLIST')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument(); // helpful count
      expect(screen.getByText('83%')).toBeInTheDocument(); // helpful percent
    });
  });

  it('renders average run time', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByText('1250ms')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockGet.mockReturnValue(new Promise(() => {})); // never resolves
    render(<AIPerformancePage />);
    expect(screen.getByTestId('performance-loading')).toBeInTheDocument();
  });
});

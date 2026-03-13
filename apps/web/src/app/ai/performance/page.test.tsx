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

const mockContentStats = {
  byStatus: { DRAFT: 10, IN_REVIEW: 5, PUBLISHED: 20, REJECTED: 3 },
  byTier: { GREEN: 15, YELLOW: 10, RED: 3 },
  byContentType: { BLOG: 12, SOCIAL: 8, EMAIL: 5 },
  byPillar: { 'Product Education': 10, 'Social Proof': 8, 'Industry Trends': 5 },
};

const mockRejectionStats = {
  byGate: { GATE_1: 3, GATE_2: 5, GATE_3: 2, GATE_4: 1 },
  byCode: { R01: 3, R02: 2, R05: 4, R07: 1 },
  byAgent: { BlogWriter: 5, SocialCreator: 3 },
  bySeverity: { MINOR: 4, MAJOR: 5, CRITICAL: 2 },
};

const mockAbTests = [
  {
    id: 'ab-1',
    name: 'CTA Button Color',
    status: 'COMPLETED',
    metric: 'click_rate',
    winnerVariantId: 'v-1',
    confidence: 95,
  },
  {
    id: 'ab-2',
    name: 'Email Subject Line',
    status: 'RUNNING',
    metric: 'open_rate',
    winnerVariantId: null,
    confidence: null,
  },
];

const mockAgentStats = {
  totalRuns: 150,
  byAgent: [
    { agentType: 'BlogWriter', _count: 50 },
    { agentType: 'SocialCreator', _count: 40 },
  ],
  byStatus: [
    { status: 'SUCCESS', _count: 130 },
    { status: 'FAILURE', _count: 20 },
  ],
};

describe('AIPerformancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/marketing-content/stats')) return Promise.resolve(mockContentStats);
      if (url.includes('/rejection-analytics/stats')) return Promise.resolve(mockRejectionStats);
      if (url.includes('/ab-testing')) return Promise.resolve(mockAbTests);
      if (url.includes('/agent-runs/stats')) return Promise.resolve(mockAgentStats);
      return Promise.resolve(null);
    });
  });

  it('renders KPI cards with marketing metrics', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('kpi-grid')).toBeInTheDocument();
      expect(screen.getByText('38')).toBeInTheDocument(); // Total Content (10+5+20+3)
      expect(screen.getByText('29%')).toBeInTheDocument(); // Rejection Rate (11/38)
      expect(screen.getByText('150')).toBeInTheDocument(); // Agent Runs
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

  it('renders content tier distribution chart', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('tier-chart')).toBeInTheDocument();
    });
  });

  it('renders pillar balance chart', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('pillar-chart')).toBeInTheDocument();
    });
  });

  it('renders rejection analytics charts', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('rejection-gate-chart')).toBeInTheDocument();
      expect(screen.getByTestId('rejection-code-chart')).toBeInTheDocument();
      expect(screen.getByTestId('severity-chart')).toBeInTheDocument();
    });
  });

  it('renders A/B test summary table', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('ab-test-summary')).toBeInTheDocument();
      expect(screen.getByText('CTA Button Color')).toBeInTheDocument();
      expect(screen.getByText('Email Subject Line')).toBeInTheDocument();
      expect(screen.getByText('Winner declared')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument(); // confidence
    });
  });

  it('renders agent comparison chart', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('agent-comparison-chart')).toBeInTheDocument();
    });
  });

  it('shows A/B test win rate in KPIs', async () => {
    render(<AIPerformancePage />);
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument(); // 1/1 completed test has winner
    });
  });

  it('shows loading state initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AIPerformancePage />);
    expect(screen.getByTestId('performance-loading')).toBeInTheDocument();
  });
});

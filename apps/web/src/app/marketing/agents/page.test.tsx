import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}));

jest.mock('lucide-react', () => ({
  Bot: (props: any) => <div data-testid="bot-icon" {...props} />,
  Play: (props: any) => <div data-testid="play-icon" {...props} />,
  Clock: (props: any) => <div data-testid="clock-icon" {...props} />,
  CheckCircle2: (props: any) => <div data-testid="check-circle" {...props} />,
  XCircle: (props: any) => <div data-testid="x-circle" {...props} />,
  Zap: (props: any) => <div data-testid="zap-icon" {...props} />,
  BarChart3: (props: any) => <div data-testid="bar-chart" {...props} />,
  Send: (props: any) => <div data-testid="send-icon" {...props} />,
  FileText: (props: any) => <div data-testid="file-text-icon" {...props} />,
  X: (props: any) => <div data-testid="x-icon" {...props} />,
  TrendingUp: (props: any) => <div data-testid="trending-up" {...props} />,
  Activity: (props: any) => <div data-testid="activity-icon" {...props} />,
  ArrowRight: (props: any) => <div data-testid="arrow-right" {...props} />,
}));

import MarketingAgentsPage from './page';

const mockConfigs = [
  {
    id: 'c1',
    agentType: 'MKT_BLOG_WRITER',
    isEnabled: true,
    config: {},
    runIntervalMinutes: 360,
    performanceScore: 85,
    lastRunAt: '2026-03-12T08:00:00Z',
    nextRunAt: '2026-03-12T14:00:00Z',
  },
  {
    id: 'c2',
    agentType: 'MKT_SOCIAL_CREATOR',
    isEnabled: false,
    config: {},
    runIntervalMinutes: 240,
    performanceScore: 72,
  },
  {
    id: 'c3',
    agentType: 'MKT_SCHEDULER',
    isEnabled: true,
    config: {},
    runIntervalMinutes: 120,
    performanceScore: 90,
  },
  {
    id: 'c4',
    agentType: 'MKT_PERF_TRACKER',
    isEnabled: true,
    config: {},
    runIntervalMinutes: 240,
    performanceScore: 88,
  },
];

const mockRuns = [
  {
    id: 'r1',
    agentType: 'MKT_BLOG_WRITER',
    status: 'COMPLETED',
    cardsCreated: 3,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: 'r2',
    agentType: 'MKT_SCHEDULER',
    status: 'FAILED',
    cardsCreated: 0,
    startedAt: new Date().toISOString(),
    error: 'Test error',
  },
];

const mockPerformance = [
  {
    agentType: 'MKT_BLOG_WRITER',
    performanceScore: 85,
    totalRuns: 20,
    successRate: 95,
    avgItemsPerRun: 2.5,
  },
];

const mockDetailRuns = [
  {
    id: 'dr1',
    agentType: 'MKT_BLOG_WRITER',
    status: 'COMPLETED',
    cardsCreated: 2,
    startedAt: '2026-03-12T08:00:00Z',
    completedAt: '2026-03-12T08:05:00Z',
  },
  {
    id: 'dr2',
    agentType: 'MKT_BLOG_WRITER',
    status: 'COMPLETED',
    cardsCreated: 3,
    startedAt: '2026-03-11T08:00:00Z',
    completedAt: '2026-03-11T08:04:00Z',
  },
];

describe('MarketingAgentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/agent-config/performance')) return Promise.resolve(mockPerformance);
      if (url.includes('/agent-config')) return Promise.resolve(mockConfigs);
      if (url.includes('/agent-runs') && url.includes('agentType='))
        return Promise.resolve(mockDetailRuns);
      if (url.includes('/agent-runs')) return Promise.resolve({ items: mockRuns });
      return Promise.resolve([]);
    });
    mockPost.mockResolvedValue({});
    mockPatch.mockResolvedValue({});
  });

  it('renders the page with title', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Marketing Agents')).toBeInTheDocument();
    });
  });

  it('renders stats strip with performance', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('stats-strip')).toBeInTheDocument();
      expect(screen.getByTestId('enabled-count')).toBeInTheDocument();
      expect(screen.getByTestId('avg-performance')).toBeInTheDocument();
    });
  });

  it('renders agent cards', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('agent-list')).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId('agent-card');
    expect(cards.length).toBe(12);
  });

  it('shows category badges on agent cards', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('category-badge').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Content').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Distribution').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0);
  });

  it('shows performance scores on cards', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('performance-score').length).toBeGreaterThan(0);
    });
  });

  it('renders toggle buttons', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('toggle-btn').length).toBe(12);
    });
  });

  it('renders run now buttons', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('run-now-btn').length).toBe(12);
    });
  });

  it('calls toggle endpoint on /agent-config', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('toggle-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('toggle-btn')[0]);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/agent-config/MKT_BLOG_WRITER',
        expect.objectContaining({ isEnabled: false }),
      );
    });
  });

  it('calls run-now endpoint on /agent-config', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('run-now-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('run-now-btn')[0]);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/agent-config/MKT_BLOG_WRITER/run-now', {});
    });
  });

  it('filters agents by tab', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-content')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-content'));

    await waitFor(() => {
      const cards = screen.getAllByTestId('agent-card');
      expect(cards.length).toBe(6);
    });
  });

  it('filters to distribution tab', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-distribution')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-distribution'));

    await waitFor(() => {
      const cards = screen.getAllByTestId('agent-card');
      expect(cards.length).toBe(2);
    });
  });

  it('filters to analytics tab', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-analytics')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-analytics'));

    await waitFor(() => {
      const cards = screen.getAllByTestId('agent-card');
      expect(cards.length).toBe(4);
    });
  });

  it('opens agent detail modal on card click', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('agent-card')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('agent-card')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('agent-detail-modal')).toBeInTheDocument();
      expect(screen.getAllByText('Blog Writer').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows performance metrics in detail modal', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('agent-card')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('agent-card')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('agent-metrics')).toBeInTheDocument();
      expect(screen.getByTestId('items-produced')).toBeInTheDocument();
      expect(screen.getByTestId('approval-rate')).toBeInTheDocument();
      expect(screen.getByTestId('avg-quality')).toBeInTheDocument();
    });
  });

  it('shows run history in detail modal', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('agent-card')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('agent-card')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('run-history')).toBeInTheDocument();
      expect(screen.getAllByTestId('run-entry').length).toBe(2);
    });
  });

  it('shows configuration in detail modal', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('agent-card')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('agent-card')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('agent-config-detail')).toBeInTheDocument();
    });
  });

  it('closes modal when close button clicked', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('agent-card')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('agent-card')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('agent-detail-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('close-modal-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('agent-detail-modal')).not.toBeInTheDocument();
    });
  });

  it('renders tab filters', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-filters')).toBeInTheDocument();
    });

    expect(screen.getByTestId('tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('tab-content')).toBeInTheDocument();
    expect(screen.getByTestId('tab-distribution')).toBeInTheDocument();
    expect(screen.getByTestId('tab-analytics')).toBeInTheDocument();
  });

  it('shows loading skeletons initially', () => {
    mockGet.mockImplementation(() => new Promise(() => {}));

    render(<MarketingAgentsPage />);

    expect(screen.queryByTestId('agent-list')).not.toBeInTheDocument();
  });
});

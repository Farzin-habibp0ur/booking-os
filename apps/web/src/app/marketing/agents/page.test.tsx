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
  useToast: () => ({ addToast: jest.fn() }),
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
}));

import MarketingAgentsPage from './page';

const mockConfigs = [
  { id: 'c1', agentType: 'MKT_BLOG_WRITER', isEnabled: true, config: {} },
  { id: 'c2', agentType: 'MKT_SOCIAL_CREATOR', isEnabled: false, config: {} },
  { id: 'c3', agentType: 'MKT_SCHEDULER', isEnabled: true, config: {} },
  { id: 'c4', agentType: 'MKT_PERF_TRACKER', isEnabled: true, config: {} },
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

describe('MarketingAgentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/agents/config')) return Promise.resolve(mockConfigs);
      if (url.includes('/agents/runs')) return Promise.resolve({ items: mockRuns });
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

  it('renders stats strip', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('stats-strip')).toBeInTheDocument();
      expect(screen.getByTestId('enabled-count')).toBeInTheDocument();
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

  it('calls toggle endpoint when toggle clicked', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('toggle-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('toggle-btn')[0]);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/agents/config/MKT_BLOG_WRITER',
        expect.objectContaining({ isEnabled: false }),
      );
    });
  });

  it('calls trigger endpoint when Run Now clicked', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('run-now-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('run-now-btn')[0]);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/agents/MKT_BLOG_WRITER/trigger', {});
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
      expect(cards.length).toBe(6); // 6 content agents
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
      expect(cards.length).toBe(2); // 2 distribution agents
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
      expect(cards.length).toBe(4); // 4 analytics agents
    });
  });

  it('shows last run status on cards', async () => {
    render(<MarketingAgentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('agent-card').length).toBe(12);
    });

    // Blog writer has a completed run
    const statusElements = screen.getAllByTestId('last-run-status');
    expect(statusElements.length).toBeGreaterThan(0);
  });

  it('shows loading skeletons initially', () => {
    mockGet.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<MarketingAgentsPage />);

    // Should show loading state (pulse animations)
    expect(screen.queryByTestId('agent-list')).not.toBeInTheDocument();
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
});

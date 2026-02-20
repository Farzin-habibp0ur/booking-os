import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ConsoleAgentsPage from './page';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/console/agents',
}));

const { api } = jest.requireMock<{ api: jest.Mocked<(typeof import('@/lib/api'))['api']> }>(
  '@/lib/api',
);

const mockPerformance = {
  totalRuns: 42,
  successRate: 88,
  cardsCreated: 120,
  feedbackHelpfulRate: 75,
  byAgentType: [
    {
      agentType: 'WAITLIST',
      runs: 10,
      completed: 9,
      failed: 1,
      successRate: 90,
      cardsCreated: 30,
      helpfulRate: 80,
    },
    {
      agentType: 'RETENTION',
      runs: 8,
      completed: 7,
      failed: 1,
      successRate: 88,
      cardsCreated: 20,
      helpfulRate: 70,
    },
    {
      agentType: 'DATA_HYGIENE',
      runs: 12,
      completed: 10,
      failed: 2,
      successRate: 83,
      cardsCreated: 40,
      helpfulRate: 65,
    },
    {
      agentType: 'SCHEDULING_OPTIMIZER',
      runs: 6,
      completed: 6,
      failed: 0,
      successRate: 100,
      cardsCreated: 15,
      helpfulRate: 90,
    },
    {
      agentType: 'QUOTE_FOLLOWUP',
      runs: 6,
      completed: 5,
      failed: 1,
      successRate: 83,
      cardsCreated: 15,
      helpfulRate: 70,
    },
  ],
};

const mockFunnel = {
  total: 100,
  pending: 20,
  approved: 25,
  dismissed: 10,
  executed: 30,
  expired: 10,
  snoozed: 5,
  approvalRate: 55,
  executionRate: 30,
};

const mockFailures = [
  {
    error: 'Timeout connecting to API',
    count: 5,
    agentType: 'WAITLIST',
    lastSeen: '2026-02-20T10:00:00Z',
  },
  {
    error: 'Rate limit exceeded',
    count: 3,
    agentType: 'RETENTION',
    lastSeen: '2026-02-19T10:00:00Z',
  },
];

const mockAbnormal = [
  {
    businessId: 'biz1',
    businessName: 'Bad Clinic',
    businessSlug: 'bad-clinic',
    totalRuns: 20,
    failedRuns: 15,
    failureRate: 75,
    platformAvgRate: 12,
  },
];

const mockDefaults = [
  {
    id: 'd1',
    agentType: 'WAITLIST',
    maxAutonomyLevel: 'SUGGEST',
    defaultEnabled: false,
    confidenceThreshold: 0.7,
    requiresReview: true,
  },
  {
    id: 'd2',
    agentType: 'RETENTION',
    maxAutonomyLevel: 'AUTO',
    defaultEnabled: true,
    confidenceThreshold: 0.8,
    requiresReview: false,
  },
];

function setupMocks() {
  api.get.mockImplementation((url: string) => {
    if (url.includes('/performance')) return Promise.resolve(mockPerformance);
    if (url.includes('/funnel')) return Promise.resolve(mockFunnel);
    if (url.includes('/failures')) return Promise.resolve(mockFailures);
    if (url.includes('/abnormal')) return Promise.resolve(mockAbnormal);
    if (url.includes('/platform-defaults')) return Promise.resolve(mockDefaults);
    if (url.includes('/tenant/'))
      return Promise.resolve({
        businessId: 'biz1',
        businessName: 'Test Clinic',
        agents: [
          {
            agentType: 'WAITLIST',
            isEnabled: true,
            autonomyLevel: 'SUGGEST',
            runsLast7d: 5,
            successRate: 90,
            cardsCreated: 10,
          },
        ],
      });
    return Promise.resolve({});
  });
}

describe('ConsoleAgentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('shows loading state initially', () => {
    api.get.mockImplementation(() => new Promise(() => {}));
    render(<ConsoleAgentsPage />);
    expect(screen.getByTestId('agents-loading')).toBeInTheDocument();
  });

  it('renders KPI cards on performance tab', async () => {
    render(<ConsoleAgentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('total-runs')).toHaveTextContent('42');
    });
    expect(screen.getByTestId('success-rate')).toHaveTextContent('88%');
    expect(screen.getByTestId('cards-created')).toHaveTextContent('120');
    expect(screen.getByTestId('helpful-rate')).toHaveTextContent('75%');
  });

  it('renders performance table with agent types', async () => {
    render(<ConsoleAgentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('performance-table')).toBeInTheDocument();
    });
    expect(screen.getAllByText('WAITLIST').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('RETENTION').length).toBeGreaterThanOrEqual(1);
  });

  it('renders funnel section', async () => {
    render(<ConsoleAgentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('funnel-section')).toBeInTheDocument();
    });
    expect(screen.getByText('55%')).toBeInTheDocument();
  });

  it('renders failure list', async () => {
    render(<ConsoleAgentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('failure-list')).toBeInTheDocument();
    });
    expect(screen.getByText('Timeout connecting to API')).toBeInTheDocument();
  });

  it('renders abnormal tenants table', async () => {
    render(<ConsoleAgentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('abnormal-tenants')).toBeInTheDocument();
    });
    expect(screen.getByText('Bad Clinic')).toBeInTheDocument();
  });

  it('shows empty state when no runs', async () => {
    api.get.mockImplementation((url: string) => {
      if (url.includes('/performance'))
        return Promise.resolve({ ...mockPerformance, totalRuns: 0 });
      if (url.includes('/funnel')) return Promise.resolve(mockFunnel);
      if (url.includes('/failures')) return Promise.resolve([]);
      if (url.includes('/abnormal')) return Promise.resolve([]);
      return Promise.resolve({});
    });
    render(<ConsoleAgentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('shows error state', async () => {
    api.get.mockRejectedValue(new Error('Network error'));
    render(<ConsoleAgentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('agents-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('switches tabs', async () => {
    render(<ConsoleAgentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('agents-tabs')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-tenant-controls'));
    expect(screen.getByTestId('tenant-controls-tab')).toBeInTheDocument();
  });

  it('renders tenant search input on tenant controls tab', async () => {
    render(<ConsoleAgentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('agents-tabs')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-tenant-controls'));
    expect(screen.getByTestId('tenant-search-input')).toBeInTheDocument();
  });

  it('shows pause/resume buttons after tenant search', async () => {
    render(<ConsoleAgentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('agents-tabs')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-tenant-controls'));
    const input = screen.getByTestId('tenant-search-input');
    fireEvent.change(input, { target: { value: 'biz1' } });
    fireEvent.click(screen.getByTestId('search-button'));

    await waitFor(() => {
      expect(screen.getByTestId('pause-all-button')).toBeInTheDocument();
      expect(screen.getByTestId('resume-all-button')).toBeInTheDocument();
    });
  });

  it('renders platform defaults table', async () => {
    render(<ConsoleAgentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('agents-tabs')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('tab-platform-defaults'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('defaults-table')).toBeInTheDocument();
    });
  });
});

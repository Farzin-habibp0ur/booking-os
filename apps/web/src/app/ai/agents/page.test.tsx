const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    patch: (...args: any[]) => mockPatch(...args),
    post: (...args: any[]) => mockPost(...args),
  },
}));
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AIAgentsPage from './page';

const mockAllAgents = [
  {
    id: 'cfg-1',
    agentType: 'WAITLIST',
    isEnabled: true,
    autonomyLevel: 'auto',
    config: {},
    lastRunAt: '2026-03-09T10:00:00Z',
    performanceScore: 85,
  },
  {
    id: 'cfg-2',
    agentType: 'RETENTION',
    isEnabled: false,
    autonomyLevel: 'assist',
    config: {},
    lastRunAt: null,
    performanceScore: 60,
  },
  {
    id: 'ma-1',
    agentType: 'BlogWriter',
    isEnabled: true,
    autonomyLevel: 'auto',
    config: {},
    lastRunAt: '2026-03-09T08:00:00Z',
    runIntervalMinutes: 60,
    performanceScore: 92,
  },
  {
    id: 'ma-2',
    agentType: 'ContentPublisher',
    isEnabled: false,
    autonomyLevel: 'suggest',
    config: {},
    lastRunAt: null,
    runIntervalMinutes: 120,
    performanceScore: 45,
  },
];

const mockRuns = {
  data: [
    {
      id: 'run-1',
      agentType: 'WAITLIST',
      status: 'SUCCESS',
      startedAt: '2026-03-09T10:00:00Z',
      completedAt: '2026-03-09T10:00:05Z',
      cardsCreated: 3,
    },
    {
      id: 'run-2',
      agentType: 'WAITLIST',
      status: 'FAILURE',
      startedAt: '2026-03-09T09:00:00Z',
      completedAt: '2026-03-09T09:00:02Z',
      cardsCreated: 0,
    },
  ],
};

describe('AIAgentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/agent-config')) return Promise.resolve(mockAllAgents);
      if (url.includes('/agent-runs')) return Promise.resolve(mockRuns);
      return Promise.resolve([]);
    });
    mockPatch.mockResolvedValue({});
    mockPost.mockResolvedValue({});
  });

  it('renders core agents section', async () => {
    render(<AIAgentsPage />);
    await waitFor(() => {
      expect(screen.getByText('Core Agents')).toBeInTheDocument();
    });
  });

  it('renders agent cards with status indicator', async () => {
    render(<AIAgentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('agent-card-WAITLIST')).toBeInTheDocument();
      expect(screen.getByTestId('agent-card-RETENTION')).toBeInTheDocument();
    });
  });

  it('shows marketing agents section with tab filters', async () => {
    render(<AIAgentsPage />);
    await waitFor(() => {
      expect(screen.getByText('Marketing Agents')).toBeInTheDocument();
      expect(screen.getByTestId('agent-tab-filters')).toBeInTheDocument();
      expect(screen.getByTestId('agent-card-BlogWriter')).toBeInTheDocument();
    });
  });

  it('filters marketing agents by category tab', async () => {
    render(<AIAgentsPage />);
    await waitFor(() => screen.getByTestId('filter-distribution'));

    fireEvent.click(screen.getByTestId('filter-distribution'));

    await waitFor(() => {
      expect(screen.getByTestId('agent-card-ContentPublisher')).toBeInTheDocument();
      expect(screen.queryByTestId('agent-card-BlogWriter')).not.toBeInTheDocument();
    });
  });

  it('toggle calls API to enable/disable agent', async () => {
    render(<AIAgentsPage />);
    await waitFor(() => screen.getByTestId('toggle-WAITLIST'));

    fireEvent.click(screen.getByTestId('toggle-WAITLIST'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/agent-config/WAITLIST', { isEnabled: false });
    });
  });

  it('expands run history on click', async () => {
    render(<AIAgentsPage />);
    await waitFor(() => screen.getByTestId('expand-WAITLIST'));

    fireEvent.click(screen.getByTestId('expand-WAITLIST'));

    await waitFor(() => {
      expect(screen.getByTestId('history-WAITLIST')).toBeInTheDocument();
    });
  });

  it('shows run history entries with status icons', async () => {
    render(<AIAgentsPage />);
    await waitFor(() => screen.getByTestId('expand-WAITLIST'));

    fireEvent.click(screen.getByTestId('expand-WAITLIST'));

    await waitFor(() => {
      expect(screen.getByText('3 cards')).toBeInTheDocument();
    });
  });

  it('triggers agent run via /agent-config/:agentType/run-now', async () => {
    render(<AIAgentsPage />);
    await waitFor(() => screen.getByTestId('trigger-WAITLIST'));

    fireEvent.click(screen.getByTestId('trigger-WAITLIST'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/agent-config/WAITLIST/run-now', {});
    });
  });

  it('shows performance score bars on agent cards', async () => {
    render(<AIAgentsPage />);
    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument(); // WAITLIST score
      expect(screen.getByText('92%')).toBeInTheDocument(); // BlogWriter score
    });
  });

  it('shows empty state when no agents configured', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/agent-config')) return Promise.resolve([]);
      if (url.includes('/agent-runs')) return Promise.resolve({ data: [] });
      return Promise.resolve([]);
    });

    render(<AIAgentsPage />);
    await waitFor(() => {
      expect(screen.getByText('No Core Agents')).toBeInTheDocument();
    });
  });
});

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

const mockCoreAgents = [
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
    id: 'cfg-3',
    agentType: 'DATA_HYGIENE',
    isEnabled: true,
    autonomyLevel: 'suggest',
    config: {},
    lastRunAt: null,
    performanceScore: null,
  },
  {
    id: 'cfg-4',
    agentType: 'SCHEDULING_OPTIMIZER',
    isEnabled: false,
    autonomyLevel: 'suggest',
    config: {},
    lastRunAt: null,
    performanceScore: null,
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
      error: 'Database connection timeout',
    },
  ],
};

describe('AIAgentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/agent-config')) return Promise.resolve(mockCoreAgents);
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

  it('does not show marketing agents section', async () => {
    render(<AIAgentsPage />);
    await waitFor(() => {
      expect(screen.getByText('Core Agents')).toBeInTheDocument();
    });
    expect(screen.queryByText('Marketing Agents')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-tab-filters')).not.toBeInTheDocument();
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

  describe('FIX-16: agent run error details', () => {
    it('shows error message for failed run in history', async () => {
      render(<AIAgentsPage />);
      await waitFor(() => screen.getByTestId('expand-WAITLIST'));

      fireEvent.click(screen.getByTestId('expand-WAITLIST'));

      await waitFor(() => {
        expect(screen.getByTestId('run-error-run-2')).toBeInTheDocument();
        expect(screen.getByText(/Database connection timeout/)).toBeInTheDocument();
      });
    });

    it('does not show error div for successful run', async () => {
      render(<AIAgentsPage />);
      await waitFor(() => screen.getByTestId('expand-WAITLIST'));

      fireEvent.click(screen.getByTestId('expand-WAITLIST'));

      await waitFor(() => {
        expect(screen.queryByTestId('run-error-run-1')).not.toBeInTheDocument();
      });
    });
  });

  describe('FIX-12: no state updates after unmount', () => {
    it('unmounts without errors when data is loading', () => {
      // Delay the mock so state would be set after unmount
      let resolve: (val: any) => void;
      mockGet.mockImplementation(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      );

      const { unmount } = render(<AIAgentsPage />);
      unmount();
      // Resolve after unmount — should not trigger setState warnings
      resolve!(mockCoreAgents);
    });
  });
});

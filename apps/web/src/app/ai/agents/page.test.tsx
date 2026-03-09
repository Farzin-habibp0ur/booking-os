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
  useToast: () => mockToast,
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
    runCount: 15,
  },
  {
    id: 'cfg-2',
    agentType: 'RETENTION',
    isEnabled: false,
    autonomyLevel: 'assist',
    config: {},
    lastRunAt: null,
    runCount: 0,
  },
];

const mockMarketingAgents = [
  {
    id: 'ma-1',
    type: 'BLOG_WRITER',
    name: 'Blog Writer',
    enabled: true,
    lastRunAt: '2026-03-09T08:00:00Z',
    runCount: 10,
    runIntervalMinutes: 60,
  },
  {
    id: 'ma-2',
    type: 'SOCIAL_CREATOR',
    name: 'Social Creator',
    enabled: false,
    lastRunAt: null,
    runCount: 0,
    runIntervalMinutes: 120,
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
      error: 'Timeout',
    },
  ],
};

describe('AIAgentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/agents/config')) return Promise.resolve(mockCoreAgents);
      if (url.includes('/marketing-agents')) return Promise.resolve(mockMarketingAgents);
      if (url.includes('/agents/runs')) return Promise.resolve(mockRuns);
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

  it('shows marketing agents section', async () => {
    render(<AIAgentsPage />);
    await waitFor(() => {
      expect(screen.getByText('Marketing Agents')).toBeInTheDocument();
      expect(screen.getByTestId('marketing-agent-BLOG_WRITER')).toBeInTheDocument();
    });
  });

  it('toggle calls API to enable/disable agent', async () => {
    render(<AIAgentsPage />);
    await waitFor(() => screen.getByTestId('toggle-WAITLIST'));

    fireEvent.click(screen.getByTestId('toggle-WAITLIST'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/agents/config/WAITLIST', { isEnabled: false });
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

  it('triggers agent run on Run Now click', async () => {
    render(<AIAgentsPage />);
    await waitFor(() => screen.getByTestId('trigger-WAITLIST'));

    fireEvent.click(screen.getByTestId('trigger-WAITLIST'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/agents/WAITLIST/trigger', {});
    });
  });

  it('shows empty state when no core agents', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/agents/config')) return Promise.resolve([]);
      if (url.includes('/marketing-agents')) return Promise.resolve([]);
      if (url.includes('/agents/runs')) return Promise.resolve({ data: [] });
      return Promise.resolve([]);
    });

    render(<AIAgentsPage />);
    await waitFor(() => {
      expect(screen.getByText('No Agents Configured')).toBeInTheDocument();
    });
  });
});

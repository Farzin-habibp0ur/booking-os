jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
}));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), patch: jest.fn() },
}));
jest.mock('lucide-react', () => ({
  Bot: () => <span data-testid="bot-icon" />,
  ArrowLeft: () => <span data-testid="arrow-left-icon" />,
  ChevronDown: () => <span data-testid="chevron-down" />,
  ChevronUp: () => <span data-testid="chevron-up" />,
  FileText: () => <span data-testid="file-text-icon" />,
  Send: () => <span data-testid="send-icon" />,
  BarChart3: () => <span data-testid="bar-chart-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
  CheckCircle2: () => <span data-testid="check-icon" />,
  XCircle: () => <span data-testid="x-icon" />,
  Play: () => <span data-testid="play-icon" />,
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('@/components/skeleton', () => ({
  ListSkeleton: () => <div data-testid="list-skeleton">Loading...</div>,
}));
jest.mock('@/components/agent-skills/skill-card', () => ({
  SkillCard: ({ skill, onToggle, onAutonomyChange, disabled }: any) => (
    <div data-testid={`skill-card-${skill.agentType}`}>
      <span>{skill.name}</span>
      <span>{skill.category}</span>
      <button
        data-testid={`toggle-${skill.agentType}`}
        onClick={() => onToggle(skill.agentType, !skill.isEnabled)}
      >
        Toggle
      </button>
      <button
        data-testid={`autonomy-${skill.agentType}`}
        onClick={() => onAutonomyChange(skill.agentType, 'AUTO')}
      >
        Autonomy
      </button>
      {disabled && <span data-testid="disabled-indicator">Disabled</span>}
    </div>
  ),
}));

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { api } from '@/lib/api';
import AgentSkillsPage from './page';

const mockApi = api as jest.Mocked<typeof api>;

const mockSkills = [
  {
    agentType: 'WAITLIST',
    name: 'Waitlist Matching',
    description: 'Matches waitlisted patients',
    category: 'proactive',
    isEnabled: true,
    autonomyLevel: 'SUGGEST',
    hasConfig: true,
  },
  {
    agentType: 'RETENTION',
    name: 'Patient Retention',
    description: 'Detects overdue patients',
    category: 'proactive',
    isEnabled: false,
    autonomyLevel: 'SUGGEST',
    hasConfig: false,
  },
  {
    agentType: 'QUOTE_FOLLOWUP',
    name: 'Quote Follow-up',
    description: 'Tracks pending quotes',
    category: 'reactive',
    isEnabled: true,
    autonomyLevel: 'AUTO',
    hasConfig: true,
  },
  {
    agentType: 'DATA_HYGIENE',
    name: 'Duplicate Detection',
    description: 'Finds duplicate records',
    category: 'maintenance',
    isEnabled: false,
    autonomyLevel: 'SUGGEST',
    hasConfig: false,
  },
];

const mockMktConfigs = [
  {
    id: 'c1',
    agentType: 'MKT_BLOG_WRITER',
    isEnabled: true,
    config: { autonomyLevel: 'SUGGEST' },
    runIntervalMinutes: 60,
    performanceScore: 85,
  },
  {
    id: 'c2',
    agentType: 'MKT_SOCIAL_CREATOR',
    isEnabled: true,
    config: { autonomyLevel: 'AUTO_WITH_REVIEW' },
    runIntervalMinutes: 30,
    performanceScore: 72,
  },
  {
    id: 'c3',
    agentType: 'MKT_SCHEDULER',
    isEnabled: false,
    config: {},
    runIntervalMinutes: 120,
    performanceScore: 45,
  },
];

const mockMktPerformance = [
  {
    agentType: 'MKT_BLOG_WRITER',
    performanceScore: 85,
    totalRuns: 50,
    successRate: 92,
    avgItemsPerRun: 3.2,
  },
  {
    agentType: 'MKT_SOCIAL_CREATOR',
    performanceScore: 72,
    totalRuns: 120,
    successRate: 88,
    avgItemsPerRun: 5.1,
  },
];

function setupMocks(skills = mockSkills, configs = mockMktConfigs, perf = mockMktPerformance) {
  mockApi.get.mockImplementation((url: string) => {
    if (url === '/agent-skills') return Promise.resolve(skills);
    if (url === '/agent-config') return Promise.resolve(configs);
    if (url === '/agent-config/performance') return Promise.resolve(perf);
    return Promise.resolve([]);
  });
}

describe('AgentSkillsPage', () => {
  beforeEach(() => jest.clearAllMocks());

  // --- Operational Agent Skills Tests ---

  it('shows loading skeleton then renders skills', async () => {
    setupMocks();
    render(<AgentSkillsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('agent-skills-page')).toBeInTheDocument();
    });
    expect(screen.getByText('Agent Skills')).toBeInTheDocument();
    expect(screen.getByText('Waitlist Matching')).toBeInTheDocument();
    expect(screen.getByText('Quote Follow-up')).toBeInTheDocument();
  });

  it('groups skills by category', async () => {
    setupMocks();
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('agent-skills-page'));
    expect(screen.getByText('Proactive Agents')).toBeInTheDocument();
    expect(screen.getByText('Reactive Agents')).toBeInTheDocument();
    expect(screen.getByText('Maintenance Agents')).toBeInTheDocument();
  });

  it('handles API error on load gracefully', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));
    render(<AgentSkillsPage />);

    // Each fetch catches silently, so page renders with empty data
    await waitFor(() => {
      expect(screen.getByTestId('agent-skills-page')).toBeInTheDocument();
    });
    expect(screen.getByText(/No agent skills available/)).toBeInTheDocument();
  });

  it('shows empty state when no skills', async () => {
    setupMocks([], mockMktConfigs, mockMktPerformance);
    render(<AgentSkillsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No agent skills available/)).toBeInTheDocument();
    });
  });

  it('enables a skill on toggle', async () => {
    setupMocks();
    mockApi.patch.mockResolvedValue({ isEnabled: true });
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('agent-skills-page'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle-RETENTION'));
    });

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/agent-skills/RETENTION/enable');
    });
    expect(mockToast).toHaveBeenCalledWith('RETENTION enabled');
  });

  it('disables a skill on toggle', async () => {
    setupMocks();
    mockApi.patch.mockResolvedValue({ isEnabled: false });
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('agent-skills-page'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle-WAITLIST'));
    });

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/agent-skills/WAITLIST/disable');
    });
    expect(mockToast).toHaveBeenCalledWith('WAITLIST disabled');
  });

  it('updates autonomy level', async () => {
    setupMocks();
    mockApi.patch.mockResolvedValue({ autonomyLevel: 'AUTO' });
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('agent-skills-page'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('autonomy-WAITLIST'));
    });

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/agent-skills/WAITLIST/config', {
        autonomyLevel: 'AUTO',
      });
    });
    expect(mockToast).toHaveBeenCalledWith('Autonomy level updated');
  });

  it('shows error toast on toggle failure', async () => {
    setupMocks();
    mockApi.patch.mockRejectedValue(new Error('Forbidden'));
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('agent-skills-page'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle-WAITLIST'));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to disable skill', 'error');
    });
  });

  it('shows error toast on autonomy update failure', async () => {
    setupMocks();
    mockApi.patch.mockRejectedValue(new Error('Server error'));
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('agent-skills-page'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('autonomy-WAITLIST'));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to update autonomy level', 'error');
    });
  });

  // --- Marketing Agents Section Tests ---

  it('renders marketing agents section', async () => {
    setupMocks();
    render(<AgentSkillsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('marketing-agents-section')).toBeInTheDocument();
    });
    expect(screen.getByText('Marketing Agents')).toBeInTheDocument();
  });

  it('renders marketing agent category groups', async () => {
    setupMocks();
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('marketing-agents-section'));
    expect(screen.getByText('Content Agents')).toBeInTheDocument();
    expect(screen.getByText('Distribution Agents')).toBeInTheDocument();
    expect(screen.getByText('Analytics Agents')).toBeInTheDocument();
  });

  it('renders 12 marketing agent cards', async () => {
    setupMocks();
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('marketing-agents-section'));
    const cards = screen.getAllByTestId('mkt-agent-card');
    expect(cards.length).toBe(12);
  });

  it('renders marketing agent names', async () => {
    setupMocks();
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('marketing-agents-section'));
    expect(screen.getByText('Blog Writer')).toBeInTheDocument();
    expect(screen.getByText('Social Creator')).toBeInTheDocument();
    expect(screen.getByText('Content Scheduler')).toBeInTheDocument();
    expect(screen.getByText('Performance Tracker')).toBeInTheDocument();
  });

  it('expands config panel on chevron click', async () => {
    setupMocks();
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('marketing-agents-section'));

    const expandBtns = screen.getAllByTestId('mkt-expand-btn');
    fireEvent.click(expandBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('mkt-config-panel')).toBeInTheDocument();
    });
  });

  it('shows interval presets in expanded panel', async () => {
    setupMocks();
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('marketing-agents-section'));

    const expandBtns = screen.getAllByTestId('mkt-expand-btn');
    fireEvent.click(expandBtns[0]);

    await waitFor(() => screen.getByTestId('mkt-config-panel'));
    expect(screen.getByTestId('interval-15')).toBeInTheDocument();
    expect(screen.getByTestId('interval-30')).toBeInTheDocument();
    expect(screen.getByTestId('interval-60')).toBeInTheDocument();
    expect(screen.getByTestId('interval-120')).toBeInTheDocument();
    expect(screen.getByTestId('interval-240')).toBeInTheDocument();
    expect(screen.getByTestId('interval-custom')).toBeInTheDocument();
  });

  it('shows autonomy select in expanded panel', async () => {
    setupMocks();
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('marketing-agents-section'));

    const expandBtns = screen.getAllByTestId('mkt-expand-btn');
    fireEvent.click(expandBtns[0]);

    await waitFor(() => screen.getByTestId('mkt-config-panel'));
    expect(screen.getByTestId('mkt-autonomy-select')).toBeInTheDocument();
    expect(screen.getByText('Autonomy Level')).toBeInTheDocument();
  });

  it('shows performance summary in expanded panel', async () => {
    setupMocks();
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('marketing-agents-section'));

    const expandBtns = screen.getAllByTestId('mkt-expand-btn');
    fireEvent.click(expandBtns[0]);

    await waitFor(() => screen.getByTestId('mkt-perf-summary'));
    expect(screen.getByText('Total Runs')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg Items')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
  });

  it('toggles marketing agent on click', async () => {
    setupMocks();
    mockApi.patch.mockResolvedValue({});
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('marketing-agents-section'));

    const toggleBtns = screen.getAllByTestId('mkt-toggle-btn');
    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/agent-config/MKT_BLOG_WRITER', {
        isEnabled: false,
      });
    });
  });

  it('updates interval on preset click', async () => {
    setupMocks();
    mockApi.patch.mockResolvedValue({});
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('marketing-agents-section'));

    const expandBtns = screen.getAllByTestId('mkt-expand-btn');
    fireEvent.click(expandBtns[0]);

    await waitFor(() => screen.getByTestId('interval-30'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('interval-30'));
    });

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/agent-config/MKT_BLOG_WRITER', {
        runIntervalMinutes: 30,
      });
    });
  });

  it('collapses panel on second chevron click', async () => {
    setupMocks();
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('marketing-agents-section'));

    const expandBtns = screen.getAllByTestId('mkt-expand-btn');
    fireEvent.click(expandBtns[0]);
    await waitFor(() => screen.getByTestId('mkt-config-panel'));

    fireEvent.click(expandBtns[0]);
    await waitFor(() => {
      expect(screen.queryByTestId('mkt-config-panel')).not.toBeInTheDocument();
    });
  });
});

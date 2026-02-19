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

describe('AgentSkillsPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows loading skeleton then renders skills', async () => {
    mockApi.get.mockResolvedValue(mockSkills);
    render(<AgentSkillsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('agent-skills-page')).toBeInTheDocument();
    });
    expect(screen.getByText('Agent Skills')).toBeInTheDocument();
    expect(screen.getByText('Waitlist Matching')).toBeInTheDocument();
    expect(screen.getByText('Quote Follow-up')).toBeInTheDocument();
  });

  it('groups skills by category', async () => {
    mockApi.get.mockResolvedValue(mockSkills);
    render(<AgentSkillsPage />);

    await waitFor(() => screen.getByTestId('agent-skills-page'));
    expect(screen.getByText('Proactive Agents')).toBeInTheDocument();
    expect(screen.getByText('Reactive Agents')).toBeInTheDocument();
    expect(screen.getByText('Maintenance Agents')).toBeInTheDocument();
  });

  it('handles API error on load', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));
    render(<AgentSkillsPage />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to load agent skills', 'error');
    });
  });

  it('shows empty state when no skills', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<AgentSkillsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No agent skills available/)).toBeInTheDocument();
    });
  });

  it('enables a skill on toggle', async () => {
    mockApi.get.mockResolvedValue(mockSkills);
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
    mockApi.get.mockResolvedValue(mockSkills);
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
    mockApi.get.mockResolvedValue(mockSkills);
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
    mockApi.get.mockResolvedValue(mockSkills);
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
    mockApi.get.mockResolvedValue(mockSkills);
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
});

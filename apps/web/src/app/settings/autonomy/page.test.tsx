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
  api: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));
jest.mock('@/components/autonomy', () => ({
  AutonomySettings: ({ configs, onUpdate, loading }: any) => (
    <div data-testid="autonomy-settings">
      {configs?.length || 0} configs
      <button data-testid="update-btn" onClick={() => onUpdate('DEPOSIT_PENDING', 'AUTO')}>
        Update
      </button>
      {loading && <span data-testid="updating">Updating...</span>}
    </div>
  ),
}));
jest.mock('@/components/skeleton', () => ({
  FormSkeleton: () => <div data-testid="form-skeleton">Loading...</div>,
}));

jest.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="arrow-left-icon" />,
  RotateCcw: (p: any) => <span data-testid="rotate-icon" {...p} />,
  Shield: () => <span data-testid="shield-icon" />,
  Bot: () => <span data-testid="bot-icon" />,
}));

jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { api } from '@/lib/api';
import AutonomySettingsPage from './page';

const mockApi = api as jest.Mocked<typeof api>;

const mockOpConfigs = [
  { actionType: 'DEPOSIT_PENDING', autonomyLevel: 'AUTO' },
  { actionType: '*', autonomyLevel: 'ASSISTED' },
];

const mockMktAutonomy = [
  { actionType: 'GREEN_CONTENT_PUBLISH', autonomyLevel: 'AUTO_WITH_REVIEW' },
  { actionType: 'YELLOW_CONTENT_PUBLISH', autonomyLevel: 'SUGGEST' },
  { actionType: 'RED_CONTENT_PUBLISH', autonomyLevel: 'OFF' },
  { actionType: 'EMAIL_SEQUENCE_SEND', autonomyLevel: 'AUTO_WITH_REVIEW' },
  { actionType: 'SOCIAL_POSTING', autonomyLevel: 'SUGGEST' },
  { actionType: 'BUDGET_ALLOCATION', autonomyLevel: 'OFF' },
  { actionType: 'AGENT_SCHEDULING', autonomyLevel: 'AUTO_WITH_REVIEW' },
  { actionType: 'ESCALATION_HANDLING', autonomyLevel: 'SUGGEST' },
];

function setupMocks(opConfigs = mockOpConfigs, mktAutonomy = mockMktAutonomy) {
  mockApi.get.mockImplementation((url: string) => {
    if (url === '/autonomy') return Promise.resolve(opConfigs);
    if (url === '/autonomy-settings') return Promise.resolve(mktAutonomy);
    return Promise.resolve([]);
  });
}

describe('AutonomySettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Operational Autonomy Tests ---

  it('shows loading state then renders settings', async () => {
    setupMocks();
    render(<AutonomySettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('autonomy-settings-page')).toBeInTheDocument();
    });
    expect(screen.getByText('2 configs')).toBeInTheDocument();
  });

  it('handles API error on load', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/autonomy') return Promise.reject(new Error('Network error'));
      if (url === '/autonomy-settings') return Promise.resolve([]);
      return Promise.resolve([]);
    });

    render(<AutonomySettingsPage />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to load autonomy settings', 'error');
    });
  });

  it('updates autonomy level on action', async () => {
    setupMocks();
    mockApi.patch.mockResolvedValue({ actionType: 'DEPOSIT_PENDING', autonomyLevel: 'AUTO' });

    render(<AutonomySettingsPage />);
    await waitFor(() => screen.getByTestId('autonomy-settings'));

    fireEvent.click(screen.getByTestId('update-btn'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/autonomy/DEPOSIT_PENDING', {
        autonomyLevel: 'AUTO',
      });
    });
  });

  it('shows error toast on update failure', async () => {
    setupMocks();
    mockApi.patch.mockRejectedValue(new Error('Forbidden'));

    render(<AutonomySettingsPage />);
    await waitFor(() => screen.getByTestId('autonomy-settings'));

    fireEvent.click(screen.getByTestId('update-btn'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to update autonomy level', 'error');
    });
  });

  // --- Marketing Autonomy Tests ---

  it('renders marketing autonomy section', async () => {
    setupMocks();
    render(<AutonomySettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('marketing-autonomy-section')).toBeInTheDocument();
    });
    expect(screen.getByText('Marketing Autonomy')).toBeInTheDocument();
  });

  it('renders marketing autonomy table with 8 action types', async () => {
    setupMocks();
    render(<AutonomySettingsPage />);

    await waitFor(() => screen.getByTestId('marketing-autonomy-table'));

    const rows = screen.getAllByTestId('autonomy-row');
    expect(rows.length).toBe(8);
  });

  it('renders action type labels', async () => {
    setupMocks();
    render(<AutonomySettingsPage />);

    await waitFor(() => screen.getByTestId('marketing-autonomy-table'));
    expect(screen.getByText('Green Content Publish')).toBeInTheDocument();
    expect(screen.getByText('Yellow Content Publish')).toBeInTheDocument();
    expect(screen.getByText('Red Content Publish')).toBeInTheDocument();
    expect(screen.getByText('Email Sequences')).toBeInTheDocument();
    expect(screen.getByText('Social Posting')).toBeInTheDocument();
    expect(screen.getByText('Budget Allocation')).toBeInTheDocument();
    expect(screen.getByText('Agent Scheduling')).toBeInTheDocument();
    expect(screen.getByText('Escalation Handling')).toBeInTheDocument();
  });

  it('renders 4 level buttons per row', async () => {
    setupMocks();
    render(<AutonomySettingsPage />);

    await waitFor(() => screen.getByTestId('marketing-autonomy-table'));

    expect(screen.getByTestId('level-GREEN_CONTENT_PUBLISH-OFF')).toBeInTheDocument();
    expect(screen.getByTestId('level-GREEN_CONTENT_PUBLISH-SUGGEST')).toBeInTheDocument();
    expect(screen.getByTestId('level-GREEN_CONTENT_PUBLISH-AUTO_WITH_REVIEW')).toBeInTheDocument();
    expect(screen.getByTestId('level-GREEN_CONTENT_PUBLISH-FULL_AUTO')).toBeInTheDocument();
  });

  it('shows recommended badge when level matches recommendation', async () => {
    setupMocks();
    render(<AutonomySettingsPage />);

    await waitFor(() => screen.getByTestId('marketing-autonomy-table'));

    const badges = screen.getAllByTestId('recommended-badge');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('updates marketing autonomy on level click', async () => {
    setupMocks();
    mockApi.patch.mockResolvedValue({});
    render(<AutonomySettingsPage />);

    await waitFor(() => screen.getByTestId('marketing-autonomy-table'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('level-GREEN_CONTENT_PUBLISH-FULL_AUTO'));
    });

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/autonomy-settings/GREEN_CONTENT_PUBLISH', {
        autonomyLevel: 'FULL_AUTO',
      });
    });
  });

  it('renders reset to defaults button', async () => {
    setupMocks();
    render(<AutonomySettingsPage />);

    await waitFor(() => screen.getByTestId('reset-defaults-btn'));
    expect(screen.getByText('Reset to Defaults')).toBeInTheDocument();
  });

  it('calls reset API on reset button click', async () => {
    setupMocks();
    mockApi.post.mockResolvedValue({});
    render(<AutonomySettingsPage />);

    await waitFor(() => screen.getByTestId('reset-defaults-btn'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('reset-defaults-btn'));
    });

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/autonomy-settings/reset', {});
    });
  });

  it('shows error toast on marketing update failure', async () => {
    setupMocks();
    mockApi.patch.mockRejectedValue(new Error('Server error'));
    render(<AutonomySettingsPage />);

    await waitFor(() => screen.getByTestId('marketing-autonomy-table'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('level-RED_CONTENT_PUBLISH-SUGGEST'));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to update', 'error');
    });
  });
});

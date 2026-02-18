import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AutomationsPage from './page';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'test-id' }),
}));

// Mock next/link
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

// Mock auth
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    login: jest.fn(),
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

// Mock i18n
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
  I18nProvider: ({ children }: any) => children,
}));

// Mock vertical-pack
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
    customerFields: [],
  }),
  VerticalPackProvider: ({ children }: any) => children,
}));

// Mock toast
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => children,
}));

// Mock cn
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock api
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
    upload: jest.fn(),
  },
}));

// Mock skeleton components
jest.mock('@/components/skeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton">Loading...</div>,
  TableRowSkeleton: ({ cols }: any) => (
    <tr data-testid="table-skeleton">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} />
      ))}
    </tr>
  ),
  EmptyState: ({ title, icon: Icon, description }: any) => (
    <div data-testid="empty-state">
      {Icon && <Icon />}
      <div>{title}</div>
      {description && <div>{description}</div>}
    </div>
  ),
}));

// Mock tooltip-nudge
jest.mock('@/components/tooltip-nudge', () => ({
  __esModule: true,
  default: ({ id, title, description }: any) => (
    <div data-testid={`tooltip-${id}`}>
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Zap: () => <div data-testid="zap-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  ToggleLeft: () => <div data-testid="toggle-left-icon" />,
  ToggleRight: () => <div data-testid="toggle-right-icon" />,
  Trash2: () => <div data-testid="trash2-icon" />,
  Play: () => <div data-testid="play-icon" />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const mockPlaybooks = [
  {
    playbook: 'pb1',
    id: 'r1',
    name: 'Welcome Message',
    description: 'Send welcome after first booking',
    isActive: true,
  },
  {
    playbook: 'pb2',
    id: 'r2',
    name: 'No-Show Follow-up',
    description: 'Auto-message after no-show',
    isActive: false,
  },
];

const mockRules = [
  {
    id: 'rule1',
    name: 'Tag VIP',
    trigger: 'BOOKING_COMPLETED',
    isActive: true,
    playbook: null,
  },
  {
    id: 'rule2',
    name: 'Cancel Reminder',
    trigger: 'BOOKING_CANCELLED',
    isActive: false,
    playbook: null,
  },
  {
    id: 'rule3',
    name: 'Playbook Rule',
    trigger: 'BOOKING_CREATED',
    isActive: true,
    playbook: 'pb1',
  },
];

const mockLogs = {
  data: [
    {
      id: 'log1',
      rule: { name: 'Tag VIP' },
      action: 'ADD_TAG',
      outcome: 'SENT',
      reason: null,
      createdAt: '2026-02-15T10:00:00Z',
    },
    {
      id: 'log2',
      rule: { name: 'Cancel Reminder' },
      action: 'SEND_MESSAGE',
      outcome: 'SKIPPED',
      reason: 'No phone',
      createdAt: '2026-02-14T14:00:00Z',
    },
  ],
  total: 2,
};

const setupDefaultMocks = () => {
  mockApi.get.mockImplementation((path: string) => {
    if (path === '/automations/playbooks') return Promise.resolve(mockPlaybooks);
    if (path === '/automations/rules') return Promise.resolve(mockRules);
    if (path === '/automations/logs?pageSize=50') return Promise.resolve(mockLogs);
    return Promise.resolve({});
  });
};

describe('AutomationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress window.confirm and window.alert
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Page Header ────────────────────────────────────────────

  it('renders page title', async () => {
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Automations')).toBeInTheDocument();
    });
  });

  it('renders tab buttons', async () => {
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Playbooks')).toBeInTheDocument();
      expect(screen.getByText('Custom Rules')).toBeInTheDocument();
      expect(screen.getByText('Activity Log')).toBeInTheDocument();
    });
  });

  // ─── Loading State ──────────────────────────────────────────

  it('shows loading state on initial render', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));

    render(<AutomationsPage />);

    // Playbooks tab shows pulse animations when loading
    const pulseElems = document.querySelectorAll('.animate-pulse');
    expect(pulseElems.length).toBeGreaterThan(0);
  });

  // ─── Playbooks Tab ─────────────────────────────────────────

  it('renders playbook cards', async () => {
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Welcome Message')).toBeInTheDocument();
      expect(screen.getByText('No-Show Follow-up')).toBeInTheDocument();
    });
  });

  it('shows Active/Off badges for playbooks', async () => {
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Off')).toBeInTheDocument();
    });
  });

  it('shows Enable/Disable buttons for playbooks', async () => {
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Disable')).toBeInTheDocument();
      expect(screen.getByText('Enable')).toBeInTheDocument();
    });
  });

  it('shows playbook descriptions', async () => {
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Send welcome after first booking')).toBeInTheDocument();
      expect(screen.getByText('Auto-message after no-show')).toBeInTheDocument();
    });
  });

  it('toggles playbook when Enable/Disable is clicked', async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.post.mockResolvedValue({});

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Enable')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Enable'));
    });

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/automations/playbooks/pb2/toggle');
    });
  });

  // ─── Custom Rules Tab ──────────────────────────────────────

  it('switches to Custom Rules tab and shows rules table', async () => {
    const user = userEvent.setup();
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Playbooks')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Custom Rules'));
    });

    await waitFor(() => {
      expect(screen.getByText('Tag VIP')).toBeInTheDocument();
      expect(screen.getByText('Cancel Reminder')).toBeInTheDocument();
      // Playbook rule should NOT appear (filtered by !r.playbook)
      expect(screen.queryByText('Playbook Rule')).not.toBeInTheDocument();
    });
  });

  it('shows Create Rule button on rules tab', async () => {
    const user = userEvent.setup();
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Playbooks')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Custom Rules'));
    });

    await waitFor(() => {
      expect(screen.getByText('Create Rule')).toBeInTheDocument();
    });
  });

  it('does not show Create Rule button on playbooks tab', async () => {
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Welcome Message')).toBeInTheDocument();
    });

    expect(screen.queryByText('Create Rule')).not.toBeInTheDocument();
  });

  it('navigates to /automations/new when Create Rule is clicked', async () => {
    const user = userEvent.setup();
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Playbooks')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Custom Rules'));
    });

    await waitFor(() => {
      expect(screen.getByText('Create Rule')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Create Rule'));
    });

    expect(mockPush).toHaveBeenCalledWith('/automations/new');
  });

  it('shows rule trigger type in rules table', async () => {
    const user = userEvent.setup();
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Playbooks')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Custom Rules'));
    });

    await waitFor(() => {
      expect(screen.getByText('BOOKING_COMPLETED')).toBeInTheDocument();
      expect(screen.getByText('BOOKING_CANCELLED')).toBeInTheDocument();
    });
  });

  it('shows empty state when no custom rules exist', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/automations/playbooks') return Promise.resolve(mockPlaybooks);
      if (path === '/automations/rules') return Promise.resolve([]);
      if (path === '/automations/logs?pageSize=50') return Promise.resolve({ data: [], total: 0 });
      return Promise.resolve({});
    });

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Playbooks')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Custom Rules'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No custom rules')).toBeInTheDocument();
    });
  });

  it('deletes a rule when delete button is clicked', async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.del.mockResolvedValue({});

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Playbooks')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Custom Rules'));
    });

    await waitFor(() => {
      expect(screen.getByText('Tag VIP')).toBeInTheDocument();
    });

    // Click trash icon for first rule
    const trashButtons = screen.getAllByTestId('trash2-icon');
    await act(async () => {
      await user.click(trashButtons[0]);
    });

    await waitFor(() => {
      expect(mockApi.del).toHaveBeenCalledWith('/automations/rules/rule1');
    });
  });

  it('toggles a rule when toggle button is clicked', async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.patch.mockResolvedValue({});

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Playbooks')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Custom Rules'));
    });

    await waitFor(() => {
      expect(screen.getByText('Tag VIP')).toBeInTheDocument();
    });

    // The toggle icons are in the Actions column; first rule is active (ToggleRight)
    const toggleIcons = screen.getAllByTestId('toggle-right-icon');
    await act(async () => {
      await user.click(toggleIcons[0]);
    });

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/automations/rules/rule1', { isActive: false });
    });
  });

  // ─── Activity Log Tab ──────────────────────────────────────

  it('switches to Activity Log tab and shows log entries', async () => {
    const user = userEvent.setup();
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Playbooks')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Activity Log'));
    });

    await waitFor(() => {
      expect(screen.getByText('ADD_TAG')).toBeInTheDocument();
      expect(screen.getByText('SEND_MESSAGE')).toBeInTheDocument();
      expect(screen.getByText('SENT')).toBeInTheDocument();
      expect(screen.getByText('SKIPPED')).toBeInTheDocument();
    });
  });

  it('shows skip reason in activity log', async () => {
    const user = userEvent.setup();
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Playbooks')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Activity Log'));
    });

    await waitFor(() => {
      expect(screen.getByText('No phone')).toBeInTheDocument();
    });
  });

  it('shows empty state when no logs exist', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/automations/playbooks') return Promise.resolve(mockPlaybooks);
      if (path === '/automations/rules') return Promise.resolve(mockRules);
      if (path === '/automations/logs?pageSize=50') return Promise.resolve({ data: [], total: 0 });
      return Promise.resolve({});
    });

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Playbooks')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Activity Log'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No activity yet')).toBeInTheDocument();
    });
  });

  // ─── Tooltip Nudge ──────────────────────────────────────────

  it('renders automations intro tooltip nudge', async () => {
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tooltip-automations-intro')).toBeInTheDocument();
    });
  });

  // ─── API Calls ─────────────────────────────────────────────

  it('calls all three API endpoints on mount', async () => {
    setupDefaultMocks();

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/automations/playbooks');
      expect(mockApi.get).toHaveBeenCalledWith('/automations/rules');
      expect(mockApi.get).toHaveBeenCalledWith('/automations/logs?pageSize=50');
    });
  });

  // ─── Error Toast Tests ─────────────────────────────────────

  it('shows error toast when playbooks API fails', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/automations/playbooks') return Promise.reject(new Error('Network error'));
      if (path === '/automations/rules') return Promise.resolve(mockRules);
      if (path === '/automations/logs?pageSize=50') return Promise.resolve(mockLogs);
      return Promise.resolve({});
    });

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  it('shows error toast when rules API fails', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/automations/playbooks') return Promise.resolve(mockPlaybooks);
      if (path === '/automations/rules') return Promise.reject(new Error('Network error'));
      if (path === '/automations/logs?pageSize=50') return Promise.resolve(mockLogs);
      return Promise.resolve({});
    });

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  it('shows error toast when logs API fails', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/automations/playbooks') return Promise.resolve(mockPlaybooks);
      if (path === '/automations/rules') return Promise.resolve(mockRules);
      if (path === '/automations/logs?pageSize=50')
        return Promise.reject(new Error('Network error'));
      return Promise.resolve({});
    });

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  it('shows error toast when toggling playbook fails', async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.post.mockRejectedValueOnce(new Error('Toggle failed'));

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Enable')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Enable'));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  it('shows error toast when deleting rule fails', async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.del.mockRejectedValueOnce(new Error('Delete failed'));

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Playbooks')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Custom Rules'));
    });

    await waitFor(() => {
      expect(screen.getByText('Tag VIP')).toBeInTheDocument();
    });

    const trashButtons = screen.getAllByTestId('trash2-icon');
    await act(async () => {
      await user.click(trashButtons[0]);
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  it('shows error toast when toggling rule fails', async () => {
    const user = userEvent.setup();
    setupDefaultMocks();
    mockApi.patch.mockRejectedValueOnce(new Error('Toggle failed'));

    render(<AutomationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Playbooks')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Custom Rules'));
    });

    await waitFor(() => {
      expect(screen.getByText('Tag VIP')).toBeInTheDocument();
    });

    const toggleIcons = screen.getAllByTestId('toggle-right-icon');
    await act(async () => {
      await user.click(toggleIcons[0]);
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });
});

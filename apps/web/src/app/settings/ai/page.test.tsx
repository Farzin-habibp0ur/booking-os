import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AiSettingsPage from './page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
  I18nProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
    customerFields: [],
  }),
}));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/posthog', () => ({ captureEvent: jest.fn() }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

jest.mock('lucide-react', () => ({
  Sparkles: (p: any) => <span data-testid="icon-sparkles" {...p} />,
  ArrowLeft: () => <span data-testid="arrow-left-icon" />,
  Bot: () => <span data-testid="bot-icon" />,
  Bell: () => <span data-testid="bell-icon" />,
  Shield: () => <span data-testid="shield-icon" />,
}));

jest.mock('@/components/skeleton', () => ({
  FormSkeleton: () => <div data-testid="form-skeleton">Loading...</div>,
}));

const mockSettings = {
  enabled: false,
  autoReplySuggestions: true,
  bookingAssistant: true,
  personality: 'friendly and professional',
  autoReply: {
    enabled: false,
    mode: 'all' as const,
    selectedIntents: ['GENERAL', 'BOOK_APPOINTMENT', 'CANCEL', 'RESCHEDULE', 'INQUIRY'],
  },
};

const mockAutonomySettings = [
  { actionType: 'GREEN_CONTENT_PUBLISH', autonomyLevel: 'AUTO_WITH_REVIEW' },
  { actionType: 'YELLOW_CONTENT_PUBLISH', autonomyLevel: 'SUGGEST' },
  { actionType: 'RED_CONTENT_PUBLISH', autonomyLevel: 'OFF' },
  { actionType: 'EMAIL_SEQUENCE_SEND', autonomyLevel: 'SUGGEST' },
];

describe('AiSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows loading state initially', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));
    render(<AiSettingsPage />);
    expect(screen.getByTestId('form-skeleton')).toBeInTheDocument();
  });

  test('renders settings after load with title', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve(mockSettings);
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('ai.settings_title')).toBeInTheDocument();
    });
  });

  test('shows conditional fields when AI is enabled', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve({ ...mockSettings, enabled: true });
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('ai.auto_reply_suggestions')).toBeInTheDocument();
      expect(screen.getByText('ai.booking_assistant_toggle')).toBeInTheDocument();
      expect(screen.getByText('ai.auto_reply_toggle')).toBeInTheDocument();
      expect(screen.getByText('ai.personality_label')).toBeInTheDocument();
    });
  });

  test('saves settings when save button clicked', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve(mockSettings);
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    mockApi.patch.mockResolvedValue({});
    render(<AiSettingsPage />);
    await waitFor(() => screen.getByText('ai.settings_title'));

    fireEvent.click(screen.getByText('settings.save_changes'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/ai/settings', mockSettings);
    });
  });

  test('shows saved indicator after successful save', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve(mockSettings);
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    mockApi.patch.mockResolvedValue({});
    render(<AiSettingsPage />);
    await waitFor(() => screen.getByText('ai.settings_title'));

    fireEvent.click(screen.getByText('settings.save_changes'));

    await waitFor(() => {
      expect(screen.getByText('common.saved')).toBeInTheDocument();
    });
  });

  // --- Marketing AI Section Tests ---

  test('renders marketing AI section', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve(mockSettings);
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('marketing-ai-section')).toBeInTheDocument();
    });
    expect(screen.getByText('Marketing AI')).toBeInTheDocument();
    expect(screen.getByText('Marketing Agents')).toBeInTheDocument();
  });

  test('renders marketing master toggle', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve(mockSettings);
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    render(<AiSettingsPage />);
    await waitFor(() => screen.getByTestId('marketing-ai-section'));

    const toggle = screen.getByTestId('marketing-master-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('disables marketing agents on toggle off', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve(mockSettings);
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    mockApi.patch.mockResolvedValue({});
    render(<AiSettingsPage />);
    await waitFor(() => screen.getByTestId('marketing-master-toggle'));

    fireEvent.click(screen.getByTestId('marketing-master-toggle'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/autonomy-settings/GREEN_CONTENT_PUBLISH',
        { autonomyLevel: 'OFF' },
      );
    });
  });

  test('renders autonomy level selector with 4 options', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve(mockSettings);
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    render(<AiSettingsPage />);
    await waitFor(() => screen.getByTestId('autonomy-level-selector'));

    expect(screen.getByTestId('autonomy-OFF')).toBeInTheDocument();
    expect(screen.getByTestId('autonomy-SUGGEST')).toBeInTheDocument();
    expect(screen.getByTestId('autonomy-AUTO_WITH_REVIEW')).toBeInTheDocument();
    expect(screen.getByTestId('autonomy-FULL_AUTO')).toBeInTheDocument();
  });

  test('changes default autonomy level on click', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve(mockSettings);
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    mockApi.patch.mockResolvedValue({});
    render(<AiSettingsPage />);
    await waitFor(() => screen.getByTestId('autonomy-FULL_AUTO'));

    fireEvent.click(screen.getByTestId('autonomy-FULL_AUTO'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/autonomy-settings/GREEN_CONTENT_PUBLISH',
        { autonomyLevel: 'FULL_AUTO' },
      );
    });
  });

  test('renders content review mode options', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve(mockSettings);
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    render(<AiSettingsPage />);
    await waitFor(() => screen.getByTestId('review-mode-selector'));

    expect(screen.getByTestId('review-STRICT')).toBeInTheDocument();
    expect(screen.getByTestId('review-NORMAL')).toBeInTheDocument();
    expect(screen.getByTestId('review-RELAXED')).toBeInTheDocument();
    expect(screen.getByText('Content Review Mode')).toBeInTheDocument();
  });

  test('renders notification preferences', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve(mockSettings);
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    render(<AiSettingsPage />);
    await waitFor(() => screen.getByTestId('notification-preferences'));

    expect(screen.getByText('Content ready for review')).toBeInTheDocument();
    expect(screen.getByText('Agent run failures')).toBeInTheDocument();
    expect(screen.getByText('Budget threshold reached')).toBeInTheDocument();
    expect(screen.getByText('Escalation events')).toBeInTheDocument();
    expect(screen.getByText('Content published')).toBeInTheDocument();
    expect(screen.getByText('Weekly performance digest')).toBeInTheDocument();
  });

  test('toggles notification on click', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve(mockSettings);
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    render(<AiSettingsPage />);
    await waitFor(() => screen.getByTestId('notif-CONTENT_READY'));

    const toggle = screen.getByTestId('notif-CONTENT_READY');
    // Initially on (defaultOn: true)
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('renders save marketing settings button', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve(mockSettings);
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    render(<AiSettingsPage />);
    await waitFor(() => screen.getByTestId('save-marketing-btn'));

    expect(screen.getByText('Save Marketing Settings')).toBeInTheDocument();
  });

  test('shows marketing saved indicator on save', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/ai/settings') return Promise.resolve(mockSettings);
      if (url === '/autonomy-settings') return Promise.resolve(mockAutonomySettings);
      return Promise.resolve(null);
    });
    render(<AiSettingsPage />);
    await waitFor(() => screen.getByTestId('save-marketing-btn'));

    fireEvent.click(screen.getByTestId('save-marketing-btn'));

    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument();
    });
  });
});

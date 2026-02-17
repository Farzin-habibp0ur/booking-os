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
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

jest.mock('lucide-react', () => ({
  Sparkles: (p: any) => <span data-testid="icon-sparkles" {...p} />,
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

describe('AiSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows loading state initially', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));
    render(<AiSettingsPage />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  test('renders settings after load with title', async () => {
    mockApi.get.mockResolvedValue(mockSettings);
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('ai.settings_title')).toBeInTheDocument();
    });
  });

  test('shows conditional fields when AI is enabled', async () => {
    mockApi.get.mockResolvedValue({ ...mockSettings, enabled: true });
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('ai.auto_reply_suggestions')).toBeInTheDocument();
      expect(screen.getByText('ai.booking_assistant_toggle')).toBeInTheDocument();
      expect(screen.getByText('ai.auto_reply_toggle')).toBeInTheDocument();
      expect(screen.getByText('ai.personality_label')).toBeInTheDocument();
    });
  });

  test('saves settings when save button clicked', async () => {
    mockApi.get.mockResolvedValue(mockSettings);
    mockApi.patch.mockResolvedValue({});
    render(<AiSettingsPage />);
    await waitFor(() => screen.getByText('ai.settings_title'));

    fireEvent.click(screen.getByText('settings.save_changes'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/ai/settings', mockSettings);
    });
  });

  test('shows saved indicator after successful save', async () => {
    mockApi.get.mockResolvedValue(mockSettings);
    mockApi.patch.mockResolvedValue({});
    render(<AiSettingsPage />);
    await waitFor(() => screen.getByText('ai.settings_title'));

    fireEvent.click(screen.getByText('settings.save_changes'));

    await waitFor(() => {
      expect(screen.getByText('common.saved')).toBeInTheDocument();
    });
  });
});

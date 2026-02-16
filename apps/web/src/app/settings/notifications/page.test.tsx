import { render, screen, waitFor } from '@testing-library/react';
import NotificationSettingsPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: 'OWNER', businessId: 'b1' },
    loading: false,
  }),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
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

describe('NotificationSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders notification settings page with title', async () => {
    mockApi.get.mockResolvedValue({ channels: 'both', followUpDelayHours: 2 });

    render(<NotificationSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('notification_settings.title')).toBeInTheDocument();
    });
  });

  test('renders channel preference options', async () => {
    mockApi.get.mockResolvedValue({ channels: 'both', followUpDelayHours: 2 });

    render(<NotificationSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('notification_settings.channel_both')).toBeInTheDocument();
      expect(screen.getByText('notification_settings.channel_email')).toBeInTheDocument();
      expect(screen.getByText('notification_settings.channel_whatsapp')).toBeInTheDocument();
    });
  });

  test('renders follow-up delay input', async () => {
    mockApi.get.mockResolvedValue({ channels: 'both', followUpDelayHours: 2 });

    render(<NotificationSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('notification_settings.followup_delay')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    });
  });

  test('has save button', async () => {
    mockApi.get.mockResolvedValue({ channels: 'both', followUpDelayHours: 2 });

    render(<NotificationSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('settings.save_changes')).toBeInTheDocument();
    });
  });
});

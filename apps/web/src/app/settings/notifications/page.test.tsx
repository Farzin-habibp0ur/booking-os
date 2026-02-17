import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
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

const mockSettings = {
  channels: 'both' as const,
  followUpDelayHours: 2,
  consultFollowUpDays: 3,
  treatmentCheckInHours: 24,
};

describe('NotificationSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows loading state initially', async () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));
    render(<NotificationSettingsPage />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  test('renders notification settings page with title', async () => {
    mockApi.get.mockResolvedValue(mockSettings);
    render(<NotificationSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('notification_settings.title')).toBeInTheDocument();
    });
  });

  test('renders description text', async () => {
    mockApi.get.mockResolvedValue(mockSettings);
    render(<NotificationSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('notification_settings.description')).toBeInTheDocument();
    });
  });

  test('renders channel preference options', async () => {
    mockApi.get.mockResolvedValue(mockSettings);
    render(<NotificationSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('notification_settings.channel_both')).toBeInTheDocument();
      expect(screen.getByText('notification_settings.channel_email')).toBeInTheDocument();
      expect(screen.getByText('notification_settings.channel_whatsapp')).toBeInTheDocument();
    });
  });

  test('selects correct channel on load', async () => {
    mockApi.get.mockResolvedValue({ ...mockSettings, channels: 'email' });
    render(<NotificationSettingsPage />);
    await waitFor(() => {
      const emailRadio = screen.getByText('notification_settings.channel_email')
        .closest('label')?.querySelector('input');
      expect(emailRadio).toBeChecked();
    });
  });

  test('changes channel preference', async () => {
    mockApi.get.mockResolvedValue(mockSettings);
    mockApi.patch.mockResolvedValue({});
    render(<NotificationSettingsPage />);
    await waitFor(() => screen.getByText('notification_settings.title'));

    const whatsappLabel = screen.getByText('notification_settings.channel_whatsapp');
    fireEvent.click(whatsappLabel);

    fireEvent.click(screen.getByText('settings.save_changes'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/business/notification-settings',
        expect.objectContaining({ channels: 'whatsapp' }),
      );
    });
  });

  test('renders follow-up delay input with current value', async () => {
    mockApi.get.mockResolvedValue(mockSettings);
    render(<NotificationSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('notification_settings.followup_delay')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    });
  });

  test('renders consult follow-up days input', async () => {
    mockApi.get.mockResolvedValue(mockSettings);
    render(<NotificationSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('notification_settings.consult_followup_delay')).toBeInTheDocument();
      expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    });
  });

  test('renders aftercare check-in hours input', async () => {
    mockApi.get.mockResolvedValue(mockSettings);
    render(<NotificationSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('notification_settings.aftercare_section')).toBeInTheDocument();
      expect(screen.getByDisplayValue('24')).toBeInTheDocument();
    });
  });

  test('updates follow-up delay value', async () => {
    mockApi.get.mockResolvedValue(mockSettings);
    mockApi.patch.mockResolvedValue({});
    render(<NotificationSettingsPage />);
    await waitFor(() => screen.getByDisplayValue('2'));

    const delayInput = screen.getByDisplayValue('2');
    fireEvent.change(delayInput, { target: { value: '4' } });

    fireEvent.click(screen.getByText('settings.save_changes'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/business/notification-settings',
        expect.objectContaining({ followUpDelayHours: 4 }),
      );
    });
  });

  test('clamps follow-up delay to valid range', async () => {
    mockApi.get.mockResolvedValue(mockSettings);
    mockApi.patch.mockResolvedValue({});
    render(<NotificationSettingsPage />);
    await waitFor(() => screen.getByDisplayValue('2'));

    const delayInput = screen.getByDisplayValue('2');
    fireEvent.change(delayInput, { target: { value: '100' } });

    fireEvent.click(screen.getByText('settings.save_changes'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/business/notification-settings',
        expect.objectContaining({ followUpDelayHours: 72 }), // clamped to max 72
      );
    });
  });

  test('saves all settings and shows saved indicator', async () => {
    mockApi.get.mockResolvedValue(mockSettings);
    mockApi.patch.mockResolvedValue({});
    render(<NotificationSettingsPage />);
    await waitFor(() => screen.getByText('notification_settings.title'));

    fireEvent.click(screen.getByText('settings.save_changes'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/business/notification-settings',
        mockSettings,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('common.saved')).toBeInTheDocument();
    });
  });

  test('handles loading failure gracefully', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));
    render(<NotificationSettingsPage />);

    await waitFor(() => {
      // Should stop loading and render the page with defaults
      expect(screen.getByText('notification_settings.title')).toBeInTheDocument();
    });
  });
});

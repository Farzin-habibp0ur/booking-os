import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PolicySettingsPage from './page';

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
  ShieldCheck: (p: any) => <span data-testid="icon-shield-check" {...p} />,
}));

const mockPolicySettings = {
  policyEnabled: true,
  cancellationWindowHours: 24,
  rescheduleWindowHours: 12,
  cancellationPolicyText: 'Cancel at least 24h before.',
  reschedulePolicyText: 'Reschedule at least 12h before.',
};

describe('PolicySettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows loading state initially', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));
    render(<PolicySettingsPage />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  test('renders title after load', async () => {
    mockApi.get.mockResolvedValue(mockPolicySettings);
    render(<PolicySettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('policy_settings.title')).toBeInTheDocument();
    });
  });

  test('shows policy enable checkbox', async () => {
    mockApi.get.mockResolvedValue(mockPolicySettings);
    render(<PolicySettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('policy_settings.enable_policy')).toBeInTheDocument();
      // The checkbox should be checked since policyEnabled is true
      const checkbox = screen
        .getByText('policy_settings.enable_policy')
        .closest('label')
        ?.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeChecked();
    });
  });

  test('shows cancellation and reschedule window inputs', async () => {
    mockApi.get.mockResolvedValue(mockPolicySettings);
    render(<PolicySettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('policy_settings.cancellation_window')).toBeInTheDocument();
      expect(screen.getByText('policy_settings.reschedule_window')).toBeInTheDocument();
      expect(screen.getByDisplayValue('24')).toBeInTheDocument();
      expect(screen.getByDisplayValue('12')).toBeInTheDocument();
    });
  });

  test('saves settings when save clicked', async () => {
    mockApi.get.mockResolvedValue(mockPolicySettings);
    mockApi.patch.mockResolvedValue({});
    render(<PolicySettingsPage />);
    await waitFor(() => screen.getByText('policy_settings.title'));

    fireEvent.click(screen.getByText('settings.save_changes'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/business/policy-settings', mockPolicySettings);
    });
  });
});

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SmsSettingsPage from './page';

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
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'sms.title': 'SMS Settings',
        'sms.description': 'Configure two-way SMS messaging via Twilio',
        'sms.account_config': 'Account Configuration',
        'sms.account_sid': 'Twilio Account SID',
        'sms.auth_token': 'Twilio Auth Token',
        'sms.from_number': 'Default From Number',
        'sms.from_number_hint': 'E.164 format (e.g. +1234567890)',
        'sms.status_callback_url': 'Status Callback URL',
        'sms.status_callback_hint': 'Twilio will send delivery status updates to this URL',
        'sms.save': 'Save',
        'sms.saved': 'SMS settings saved',
        'sms.save_failed': 'Failed to save SMS settings',
        'sms.location_config': 'Per-Location SMS Numbers',
        'sms.location_phone': 'SMS Phone Number',
        'sms.location_enabled': 'Enabled',
        'sms.location_saved': 'Location SMS config saved',
        'sms.location_save_failed': 'Failed to save location config',
        'sms.test_send': 'Test SMS',
        'sms.test_phone': 'Recipient Phone Number',
        'sms.test_message': 'Test Message',
        'sms.test_send_button': 'Send Test',
        'sms.test_success': 'Test SMS sent successfully',
        'sms.test_failed': 'Failed to send test SMS',
        'sms.a2p_title': 'A2P 10DLC Compliance',
        'sms.a2p_required': 'Required for US numbers',
        'sms.a2p_step1': 'Register your brand at twilio.com/console/sms/campaigns',
        'sms.a2p_step2': 'Create a messaging campaign describing your use case',
        'sms.a2p_step3': 'Assign your phone numbers to the campaign',
        'sms.a2p_step4': 'Wait for approval (typically 1-3 business days)',
        'sms.a2p_warning':
          'Non-compliant numbers may experience message filtering or delivery failures.',
        'sms.no_locations': 'No locations found. Create a location first.',
      };
      return translations[key] || key;
    },
  }),
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
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
    upload: jest.fn(),
  },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

jest.mock('lucide-react', () => ({
  ArrowLeft: (p: any) => <span data-testid="icon-arrow-left" {...p} />,
  Phone: (p: any) => <span data-testid="icon-phone" {...p} />,
  Send: (p: any) => <span data-testid="icon-send" {...p} />,
  Save: (p: any) => <span data-testid="icon-save" {...p} />,
  AlertTriangle: (p: any) => <span data-testid="icon-alert" {...p} />,
  CheckCircle: (p: any) => <span data-testid="icon-check" {...p} />,
  ClipboardList: (p: any) => <span data-testid="icon-clipboard" {...p} />,
  Info: (p: any) => <span data-testid="icon-info" {...p} />,
  Loader2: (p: any) => <span data-testid="icon-loader" {...p} />,
}));

function setupMockApi(opts?: { locations?: any[]; business?: any }) {
  const locations = opts?.locations ?? [
    { id: 'loc1', name: 'Main Office', smsConfig: null },
    {
      id: 'loc2',
      name: 'Branch Office',
      smsConfig: { phoneNumber: '+15551234567', enabled: true },
    },
  ];
  const business = opts?.business ?? {
    id: 'b1',
    channelSettings: {
      sms: {
        twilioAccountSid: 'AC1234',
        twilioAuthToken: 'token123',
        defaultFromNumber: '+15559876543',
      },
    },
  };

  mockApi.get.mockImplementation((url: string) => {
    if (url === '/business') return Promise.resolve(business);
    if (url === '/locations') return Promise.resolve(locations);
    return Promise.resolve(null);
  });
}

describe('SmsSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders page title and description', async () => {
    setupMockApi();
    render(<SmsSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('SMS Settings')).toBeInTheDocument();
      expect(screen.getByText('Configure two-way SMS messaging via Twilio')).toBeInTheDocument();
    });
  });

  test('renders all three sections', async () => {
    setupMockApi();
    render(<SmsSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Account Configuration')).toBeInTheDocument();
      expect(screen.getByText('Per-Location SMS Numbers')).toBeInTheDocument();
      expect(screen.getByText('Test SMS')).toBeInTheDocument();
    });
  });

  test('shows A2P 10DLC compliance card', async () => {
    setupMockApi();
    render(<SmsSettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('a2p-compliance-card')).toBeInTheDocument();
      expect(screen.getByText(/A2P 10DLC Compliance/)).toBeInTheDocument();
      expect(screen.getByText(/Register your brand at twilio.com/)).toBeInTheDocument();
    });
  });

  test('shows location list with two locations', async () => {
    setupMockApi();
    render(<SmsSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Main Office')).toBeInTheDocument();
      expect(screen.getByText('Branch Office')).toBeInTheDocument();
    });
  });

  test('handles empty locations', async () => {
    setupMockApi({ locations: [] });
    render(<SmsSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('No locations found. Create a location first.')).toBeInTheDocument();
    });
  });

  test('test send form renders with inputs', async () => {
    setupMockApi();
    render(<SmsSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Recipient Phone Number')).toBeInTheDocument();
      expect(screen.getByText('Test Message')).toBeInTheDocument();
      expect(screen.getByText('Send Test')).toBeInTheDocument();
    });
  });

  test('save button triggers API call for account config', async () => {
    setupMockApi();
    mockApi.patch.mockResolvedValue({});
    render(<SmsSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Account Configuration')).toBeInTheDocument();
    });

    // Find the first Save button (in account config section)
    const saveButtons = screen.getAllByText('Save');
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/business', {
        channelSettings: {
          sms: expect.objectContaining({
            twilioAccountSid: expect.any(String),
            twilioAuthToken: expect.any(String),
            defaultFromNumber: expect.any(String),
          }),
        },
      });
    });
  });

  test('error state displays when save fails', async () => {
    setupMockApi();
    mockApi.patch.mockRejectedValue(new Error('Network error'));
    render(<SmsSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Account Configuration')).toBeInTheDocument();
    });

    const saveButtons = screen.getAllByText('Save');
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to save SMS settings')).toBeInTheDocument();
    });
  });
});

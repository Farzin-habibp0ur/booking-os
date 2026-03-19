import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ChannelsSettingsPage from './page';

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
jest.mock('lucide-react', () => {
  const stub = (name: string) => {
    const C = (props: any) => <svg data-testid={`icon-${name}`} {...props} />;
    C.displayName = name;
    return C;
  };
  return new Proxy(
    {},
    {
      get: (_target, prop: string) => stub(prop),
    },
  );
});
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: any) => {
    if (params?.count !== undefined) return `${params.count} messages (7d)`;
    return key;
  }}),
  I18nProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/design-tokens', () => ({
  CHANNEL_STYLES: {
    WHATSAPP: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-400', label: 'WhatsApp', hex: '#25D366' },
    INSTAGRAM: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-400', label: 'Instagram', hex: '#E4405F' },
    FACEBOOK: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-400', label: 'Messenger', hex: '#0084FF' },
    SMS: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-400', label: 'SMS', hex: '#64748b' },
    EMAIL: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-400', label: 'Email', hex: '#0ea5e9' },
    WEB_CHAT: { bg: 'bg-lavender-50', text: 'text-lavender-700', border: 'border-lavender-400', label: 'Web Chat', hex: '#9F8ECB' },
  },
  ELEVATION: { card: 'shadow-soft rounded-2xl' },
}));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const mockBusiness = {
  name: 'Test Clinic',
  channelSettings: {
    sms: { twilioAccountSid: 'AC123' },
    whatsapp: { enabled: true },
  },
};

const mockLocationsConnected = [
  {
    id: 'loc1',
    name: 'Main',
    smsConfig: { phoneNumber: '+15551234567', enabled: true },
    facebookConfig: { pageId: 'PAGE_1', enabled: true },
    emailConfig: { inboundAddress: 'inbox@test.com', enabled: true },
    webChatConfig: { enabled: true },
    whatsappConfig: { phoneNumberId: 'WA_1' },
    instagramConfig: { pageId: 'IG_1' },
  },
];

const mockLocationsEmpty: any[] = [];

describe('ChannelsSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/business' || url.startsWith('/business')) return Promise.resolve(mockBusiness);
      if (url === '/locations') return Promise.resolve(mockLocationsConnected);
      if (url.includes('/usage')) return Promise.resolve({ channels: [] });
      return Promise.resolve({});
    });
  });

  test('renders page title', async () => {
    render(<ChannelsSettingsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('channels-title')).toBeInTheDocument();
      expect(screen.getByText('channels.title')).toBeInTheDocument();
    });
  });

  test('shows 6 channel cards', async () => {
    render(<ChannelsSettingsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('channel-card-whatsapp')).toBeInTheDocument();
      expect(screen.getByTestId('channel-card-instagram')).toBeInTheDocument();
      expect(screen.getByTestId('channel-card-facebook')).toBeInTheDocument();
      expect(screen.getByTestId('channel-card-sms')).toBeInTheDocument();
      expect(screen.getByTestId('channel-card-email')).toBeInTheDocument();
      expect(screen.getByTestId('channel-card-webchat')).toBeInTheDocument();
    });
  });

  test('shows connection status as Connected when channels are configured', async () => {
    render(<ChannelsSettingsPage />);
    await waitFor(() => {
      const connectedTexts = screen.getAllByText('channels.connected');
      expect(connectedTexts.length).toBeGreaterThanOrEqual(4);
    });
  });

  test('links to correct settings pages', async () => {
    render(<ChannelsSettingsPage />);
    await waitFor(() => screen.getByTestId('channels-grid'));

    // Click WhatsApp card -> should navigate to integrations
    fireEvent.click(screen.getByTestId('channel-card-whatsapp'));
    expect(mockPush).toHaveBeenCalledWith('/settings/integrations');

    mockPush.mockClear();
    fireEvent.click(screen.getByTestId('channel-card-sms'));
    expect(mockPush).toHaveBeenCalledWith('/settings/sms');

    mockPush.mockClear();
    fireEvent.click(screen.getByTestId('channel-card-facebook'));
    expect(mockPush).toHaveBeenCalledWith('/settings/facebook');

    mockPush.mockClear();
    fireEvent.click(screen.getByTestId('channel-card-email'));
    expect(mockPush).toHaveBeenCalledWith('/settings/email-channel');

    mockPush.mockClear();
    fireEvent.click(screen.getByTestId('channel-card-webchat'));
    expect(mockPush).toHaveBeenCalledWith('/settings/web-chat');

    mockPush.mockClear();
    fireEvent.click(screen.getByTestId('channel-card-instagram'));
    expect(mockPush).toHaveBeenCalledWith('/settings/integrations');
  });

  test('handles no channels configured — shows Not Configured status', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/business' || url.startsWith('/business'))
        return Promise.resolve({ name: 'Empty Biz', channelSettings: {} });
      if (url === '/locations') return Promise.resolve(mockLocationsEmpty);
      if (url.includes('/usage')) return Promise.resolve({ channels: [] });
      return Promise.resolve({});
    });

    render(<ChannelsSettingsPage />);
    await waitFor(() => {
      const notConfiguredTexts = screen.getAllByText('channels.not_configured');
      expect(notConfiguredTexts.length).toBe(6);
    });
  });

  test('shows message count when usage data is available', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/business' || url.startsWith('/business')) return Promise.resolve(mockBusiness);
      if (url === '/locations') return Promise.resolve(mockLocationsConnected);
      if (url.includes('/usage'))
        return Promise.resolve({
          channels: [
            { channel: 'SMS', inbound: 10, outbound: 5 },
            { channel: 'WHATSAPP', inbound: 20, outbound: 15 },
          ],
        });
      return Promise.resolve({});
    });

    render(<ChannelsSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('15 messages (7d)')).toBeInTheDocument();
      expect(screen.getByText('35 messages (7d)')).toBeInTheDocument();
    });
  });
});

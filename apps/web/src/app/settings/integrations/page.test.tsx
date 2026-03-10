import { render, screen, waitFor } from '@testing-library/react';
import IntegrationsPage from './page';

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
  Puzzle: (p: any) => <span data-testid="icon-puzzle" {...p} />,
  Calendar: (p: any) => <span data-testid="icon-calendar" {...p} />,
  CreditCard: (p: any) => <span data-testid="icon-credit-card" {...p} />,
  MessageSquare: (p: any) => <span data-testid="icon-message-square" {...p} />,
  Mail: (p: any) => <span data-testid="icon-mail" {...p} />,
  BarChart3: (p: any) => <span data-testid="icon-bar-chart" {...p} />,
  Zap: (p: any) => <span data-testid="icon-zap" {...p} />,
  BookOpen: (p: any) => <span data-testid="icon-book-open" {...p} />,
  Video: (p: any) => <span data-testid="icon-video" {...p} />,
  ExternalLink: (p: any) => <span data-testid="icon-external-link" {...p} />,
  Settings: (p: any) => <span data-testid="icon-settings" {...p} />,
  Check: (p: any) => <span data-testid="icon-check" {...p} />,
  ArrowLeft: (p: any) => <span data-testid="icon-arrow-left" {...p} />,
}));

function setupMockApi(opts?: { connections?: any[]; business?: any }) {
  const connections = opts?.connections ?? [];
  const business = opts?.business ?? { id: 'b1' };

  mockApi.get.mockImplementation((url: string) => {
    if (url === '/calendar-sync/connections') return Promise.resolve(connections);
    if (url === '/business') return Promise.resolve(business);
    return Promise.resolve(null);
  });
}

describe('IntegrationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders page title "Integrations"', async () => {
    setupMockApi();
    render(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Integrations')).toBeInTheDocument();
    });
  });

  test('renders subtitle text', async () => {
    setupMockApi();
    render(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Connect your tools and services')).toBeInTheDocument();
    });
  });

  test('shows all 9 integration cards', async () => {
    setupMockApi();
    render(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Google Calendar')).toBeInTheDocument();
      expect(screen.getByText('Microsoft Outlook')).toBeInTheDocument();
      expect(screen.getByText('Stripe')).toBeInTheDocument();
      expect(screen.getByText('WhatsApp Business')).toBeInTheDocument();
      expect(screen.getByText('Email (Resend/SendGrid)')).toBeInTheDocument();
      expect(screen.getByText('Google Analytics')).toBeInTheDocument();
      expect(screen.getByText('Zapier')).toBeInTheDocument();
      expect(screen.getByText('QuickBooks')).toBeInTheDocument();
      expect(screen.getByText('Zoom')).toBeInTheDocument();
    });
  });

  test('shows "Connected" badge for connected Google Calendar', async () => {
    setupMockApi({
      connections: [
        {
          id: 'c1',
          provider: 'google',
          syncEnabled: true,
          lastSyncedAt: null,
          lastSyncError: null,
        },
      ],
    });
    render(<IntegrationsPage />);

    await waitFor(() => {
      const badges = screen.getAllByText('Connected');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('shows "Not Connected" badge when calendar not connected', async () => {
    setupMockApi({ connections: [] });
    render(<IntegrationsPage />);

    await waitFor(() => {
      const badges = screen.getAllByText('Not Connected');
      // Google, Outlook, Stripe, WhatsApp should all be Not Connected
      expect(badges.length).toBe(4);
    });
  });

  test('shows "Coming Soon" badge for Zapier, QuickBooks, Zoom, and Google Analytics', async () => {
    setupMockApi();
    render(<IntegrationsPage />);

    await waitFor(() => {
      const badges = screen.getAllByText('Coming Soon');
      expect(badges.length).toBe(4);
    });
  });

  test('connect button links to /settings/calendar for calendar integrations', async () => {
    setupMockApi({ connections: [] });
    render(<IntegrationsPage />);

    await waitFor(() => {
      const connectLinks = screen.getAllByText('Connect');
      // Google Calendar and Outlook should have Connect buttons linking to /settings/calendar
      const calendarLinks = connectLinks.filter((link) => {
        const anchor = link.closest('a');
        return anchor?.getAttribute('href') === '/settings/calendar';
      });
      expect(calendarLinks.length).toBe(2);
    });
  });

  test('shows "Configured" badge for email integration', async () => {
    setupMockApi();
    render(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Configured')).toBeInTheDocument();
    });
  });

  test('shows loading state initially', () => {
    setupMockApi();
    render(<IntegrationsPage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('shows "Settings" button for connected integrations', async () => {
    setupMockApi({
      connections: [
        {
          id: 'c1',
          provider: 'google',
          syncEnabled: true,
          lastSyncedAt: null,
          lastSyncError: null,
        },
      ],
    });
    render(<IntegrationsPage />);

    await waitFor(() => {
      const settingsButtons = screen.getAllByText('Settings');
      // Google Calendar (connected) + Email (configured) = 2 Settings buttons
      expect(settingsButtons.length).toBe(2);
    });
  });

  test('shows Stripe as connected when business has stripeCustomerId', async () => {
    setupMockApi({
      business: {
        id: 'b1',
        subscription: { stripeCustomerId: 'cus_123' },
      },
    });
    render(<IntegrationsPage />);

    await waitFor(() => {
      const connectedBadges = screen.getAllByText('Connected');
      // Stripe should now be connected
      expect(connectedBadges.length).toBeGreaterThanOrEqual(1);
    });
  });
});

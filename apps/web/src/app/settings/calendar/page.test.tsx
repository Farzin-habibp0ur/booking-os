import { render, screen, waitFor } from '@testing-library/react';
import CalendarSyncPageWrapper from './page';

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
  CalendarDays: (p: any) => <span data-testid="icon-calendar-days" {...p} />,
  RefreshCw: (p: any) => <span data-testid="icon-refresh" {...p} />,
  Copy: (p: any) => <span data-testid="icon-copy" {...p} />,
  Check: (p: any) => <span data-testid="icon-check" {...p} />,
  ExternalLink: (p: any) => <span data-testid="icon-external-link" {...p} />,
}));

function setupMockApi(opts?: {
  connections?: any[];
  providers?: { google: boolean; outlook: boolean };
  icalUrl?: string | null;
}) {
  const connections = opts?.connections ?? [];
  const providers = opts?.providers ?? { google: true, outlook: true };
  const icalUrl = opts?.icalUrl ?? 'https://example.com/ical/feed123';

  mockApi.get.mockImplementation((url: string) => {
    if (url === '/calendar-sync/connections') return Promise.resolve(connections);
    if (url === '/calendar-sync/providers') return Promise.resolve(providers);
    if (url === '/calendar-sync/ical-feed-url') return Promise.resolve({ url: icalUrl });
    return Promise.resolve(null);
  });
}

describe('CalendarSyncPageWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows loading then renders title', async () => {
    setupMockApi();
    render(<CalendarSyncPageWrapper />);

    await waitFor(() => {
      expect(screen.getByText('calendar_sync.title')).toBeInTheDocument();
    });
  });

  test('shows Google Calendar and Outlook Calendar provider cards', async () => {
    setupMockApi();
    render(<CalendarSyncPageWrapper />);

    await waitFor(() => {
      expect(screen.getByText('Google Calendar')).toBeInTheDocument();
      expect(screen.getByText('Outlook Calendar')).toBeInTheDocument();
    });
  });

  test('shows Connect button for available but not connected providers', async () => {
    setupMockApi({ providers: { google: true, outlook: true }, connections: [] });
    render(<CalendarSyncPageWrapper />);

    await waitFor(() => {
      const connectButtons = screen.getAllByText('calendar_sync.connect');
      expect(connectButtons).toHaveLength(2);
    });
  });

  test('shows iCal feed URL section', async () => {
    setupMockApi({ icalUrl: 'https://example.com/ical/feed123' });
    render(<CalendarSyncPageWrapper />);

    await waitFor(() => {
      expect(screen.getByText('calendar_sync.ical_feed')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://example.com/ical/feed123')).toBeInTheDocument();
    });
  });

  test('shows Connected status for connected providers', async () => {
    setupMockApi({
      connections: [
        { id: 'c1', provider: 'google', syncEnabled: true, lastSyncedAt: null, lastSyncError: null },
      ],
      providers: { google: true, outlook: true },
    });
    render(<CalendarSyncPageWrapper />);

    await waitFor(() => {
      expect(screen.getByText('calendar_sync.status_connected')).toBeInTheDocument();
      // Google is connected, so it should show disconnect rather than connect
      expect(screen.getByText('calendar_sync.disconnect')).toBeInTheDocument();
    });
  });
});

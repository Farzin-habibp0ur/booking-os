import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  ArrowLeft: (p: any) => <span data-testid="icon-arrow-left" {...p} />,
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
    if (url === '/business/calendar-hours') return Promise.resolve({ startHour: 8, endHour: 19 });
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

  test('shows business hours section with dropdowns', async () => {
    setupMockApi();
    render(<CalendarSyncPageWrapper />);

    await waitFor(() => {
      expect(screen.getByText('Business Hours')).toBeInTheDocument();
      expect(screen.getByLabelText('Start hour')).toBeInTheDocument();
      expect(screen.getByLabelText('End hour')).toBeInTheDocument();
      expect(screen.getByText('Save Hours')).toBeInTheDocument();
    });
  });

  test('saves business hours on click', async () => {
    setupMockApi();
    mockApi.patch.mockResolvedValue({});
    render(<CalendarSyncPageWrapper />);

    await waitFor(() => screen.getByText('Business Hours'));

    fireEvent.change(screen.getByLabelText('Start hour'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('End hour'), { target: { value: '21' } });
    fireEvent.click(screen.getByText('Save Hours'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/business/calendar-hours', {
        startHour: 7,
        endHour: 21,
      });
    });
  });

  test('shows error when start hour >= end hour', async () => {
    setupMockApi();
    render(<CalendarSyncPageWrapper />);

    await waitFor(() => screen.getByText('Business Hours'));

    fireEvent.change(screen.getByLabelText('Start hour'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('End hour'), { target: { value: '8' } });
    fireEvent.click(screen.getByText('Save Hours'));

    await waitFor(() => {
      expect(screen.getByText('Start hour must be before end hour')).toBeInTheDocument();
    });
  });

  test('shows Connected status for connected providers', async () => {
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

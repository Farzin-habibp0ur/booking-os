import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarPage from './page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next/link
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

// Mock auth
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    login: jest.fn(),
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

// Mock i18n
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  I18nProvider: ({ children }: any) => children,
}));

// Mock vertical-pack
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
    customerFields: [],
  }),
  VerticalPackProvider: ({ children }: any) => children,
}));

// Mock toast
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
  ToastProvider: ({ children }: any) => children,
}));

// Mock cn
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock api
const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));

// Mock child components
jest.mock(
  '@/components/booking-form-modal',
  () => (props: any) =>
    props.isOpen ? <div data-testid="booking-form-modal">BookingFormModal</div> : null,
);
jest.mock(
  '@/components/booking-detail-modal',
  () => (props: any) =>
    props.isOpen ? <div data-testid="booking-detail-modal">BookingDetailModal</div> : null,
);

const mockStaff = [
  { id: 's1', name: 'Sarah Johnson', role: 'ADMIN' },
  { id: 's2', name: 'Lisa Chen', role: 'SERVICE_PROVIDER' },
];

const mockLocations = [
  { id: 'loc1', name: 'Showroom', isBookable: true },
  { id: 'loc2', name: 'Service Center', isBookable: true },
];

describe('CalendarPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith('/staff')) return Promise.resolve(mockStaff);
      if (path.startsWith('/locations')) return Promise.resolve(mockLocations);
      if (path.startsWith('/bookings/calendar/month-summary')) return Promise.resolve({ days: {} });
      if (path.startsWith('/bookings/calendar')) return Promise.resolve([]);
      if (path.startsWith('/availability/calendar-context')) return Promise.resolve({});
      return Promise.resolve([]);
    });
  });

  it('renders the calendar page', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    expect(screen.getByText('calendar.title')).toBeInTheDocument();
  });

  it('fetches locations on mount', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/locations');
    });
  });

  it('renders location dropdown when locations exist', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('All locations')).toBeInTheDocument();
    });

    expect(screen.getByText('Showroom')).toBeInTheDocument();
    expect(screen.getByText('Service Center')).toBeInTheDocument();
  });

  it('does not render location dropdown when no locations exist', async () => {
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith('/staff')) return Promise.resolve(mockStaff);
      if (path.startsWith('/locations')) return Promise.resolve([]);
      if (path.startsWith('/bookings/calendar')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    await act(async () => {
      render(<CalendarPage />);
    });

    await waitFor(() => {
      expect(screen.queryByText('All locations')).not.toBeInTheDocument();
    });
  });

  it('passes locationId to calendar API when location is selected', async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<CalendarPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('All locations')).toBeInTheDocument();
    });

    // Select a location
    const select = screen.getByDisplayValue('All locations');
    await act(async () => {
      await user.selectOptions(select, 'loc1');
    });

    await waitFor(() => {
      const calendarCalls = mockGet.mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('/bookings/calendar'),
      );
      const lastCall = calendarCalls[calendarCalls.length - 1][0];
      expect(lastCall).toContain('locationId=loc1');
    });
  });

  it('renders staff filter chips', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Sarah')).toBeInTheDocument();
      expect(screen.getByText('Lisa')).toBeInTheDocument();
    });
  });

  it('renders the new booking button', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    expect(screen.getByText('calendar.new_booking')).toBeInTheDocument();
  });

  it('renders month view toggle button', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    expect(screen.getByText('calendar.view_month')).toBeInTheDocument();
  });

  it('switches to month view and fetches month summary', async () => {
    const user = userEvent.setup();

    mockGet.mockImplementation((path: string) => {
      if (path.startsWith('/staff')) return Promise.resolve(mockStaff);
      if (path.startsWith('/locations')) return Promise.resolve(mockLocations);
      if (path.startsWith('/bookings/calendar/month-summary'))
        return Promise.resolve({
          days: {
            '2026-02-15': { total: 3, confirmed: 2, pending: 1, cancelled: 0 },
          },
        });
      if (path.startsWith('/bookings/calendar')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    await act(async () => {
      render(<CalendarPage />);
    });

    const monthBtn = screen.getByText('calendar.view_month');
    await act(async () => {
      await user.click(monthBtn);
    });

    await waitFor(() => {
      const monthCalls = mockGet.mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === 'string' && call[0].includes('/bookings/calendar/month-summary'),
      );
      expect(monthCalls.length).toBeGreaterThan(0);
    });
  });

  it('renders day-of-week headers in month view', async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<CalendarPage />);
    });

    const monthBtn = screen.getByText('calendar.view_month');
    await act(async () => {
      await user.click(monthBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
    });
  });

  it('clicking a day in month view switches to day view', async () => {
    const user = userEvent.setup();

    mockGet.mockImplementation((path: string) => {
      if (path.startsWith('/staff')) return Promise.resolve(mockStaff);
      if (path.startsWith('/locations')) return Promise.resolve(mockLocations);
      if (path.startsWith('/bookings/calendar/month-summary')) return Promise.resolve({ days: {} });
      if (path.startsWith('/bookings/calendar')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    await act(async () => {
      render(<CalendarPage />);
    });

    // Switch to month view
    const monthBtn = screen.getByText('calendar.view_month');
    await act(async () => {
      await user.click(monthBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Sun')).toBeInTheDocument();
    });

    // Click on day "15"
    const day15 = screen.getByText('15');
    await act(async () => {
      await user.click(day15);
    });

    // Should switch back to day view — day-of-week headers should disappear
    await waitFor(() => {
      // Day view shows staff names as columns, not day-of-week headers
      expect(screen.queryByText('Sun')).not.toBeInTheDocument();
    });
  });

  it('fetches calendar context for working hours and time-off', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    await waitFor(() => {
      const contextCalls = mockGet.mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === 'string' && call[0].includes('/availability/calendar-context'),
      );
      expect(contextCalls.length).toBeGreaterThan(0);
      expect(contextCalls[0][0]).toContain('staffIds=');
    });
  });

  it('shows Time Off badge when staff has time off on current day', async () => {
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith('/staff')) return Promise.resolve(mockStaff);
      if (path.startsWith('/locations')) return Promise.resolve(mockLocations);
      if (path.startsWith('/bookings/calendar/month-summary')) return Promise.resolve({ days: {} });
      if (path.startsWith('/bookings/calendar')) return Promise.resolve([]);
      if (path.startsWith('/availability/calendar-context')) {
        return Promise.resolve({
          s1: {
            workingHours: [],
            timeOff: [
              {
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString(),
                reason: 'Sick',
              },
            ],
          },
          s2: { workingHours: [], timeOff: [] },
        });
      }
      return Promise.resolve([]);
    });

    await act(async () => {
      render(<CalendarPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Time Off')).toBeInTheDocument();
    });
  });
});

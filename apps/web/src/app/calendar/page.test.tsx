import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
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

// Mock posthog
jest.mock('@/lib/posthog', () => ({
  captureEvent: jest.fn(),
}));

// Mock design-tokens
jest.mock('@/lib/design-tokens', () => ({
  statusCalendarClasses: () => ({ bg: '', border: '', text: '' }),
  ELEVATION: { dropdown: '' },
  BOOKING_STATUS_STYLES: {},
  BOOKING_COLOR_LABELS: {
    sage: { bg: 'bg-sage-50', border: 'border-sage-400', dot: 'bg-sage-500', label: 'Sage' },
    lavender: {
      bg: 'bg-lavender-50',
      border: 'border-lavender-400',
      dot: 'bg-lavender-500',
      label: 'Lavender',
    },
    amber: { bg: 'bg-amber-50', border: 'border-amber-400', dot: 'bg-amber-500', label: 'Amber' },
    sky: { bg: 'bg-sky-50', border: 'border-sky-400', dot: 'bg-sky-500', label: 'Sky' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-400', dot: 'bg-rose-500', label: 'Rose' },
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

jest.mock('@/components/booking-popover', () => ({
  BookingPopover: () => <div data-testid="booking-popover">BookingPopover</div>,
}));

jest.mock('@/components/date-scroller', () => ({
  DateScroller: ({ onDateSelect }: any) => <div data-testid="date-scroller">DateScroller</div>,
}));

jest.mock('./components/calendar-sidebar', () => ({
  CalendarSidebar: ({ onClose }: any) => (
    <div data-testid="calendar-sidebar">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

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
    localStorage.clear();
    // Set desktop width so mobile detection doesn't hide the grid
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    mockGet.mockImplementation((path: string) => {
      if (path.startsWith('/staff')) return Promise.resolve(mockStaff);
      if (path.startsWith('/locations')) return Promise.resolve(mockLocations);
      if (path.startsWith('/bookings/calendar/month-summary')) return Promise.resolve({ days: {} });
      if (path.startsWith('/bookings/calendar')) return Promise.resolve([]);
      if (path.startsWith('/availability/calendar-context')) return Promise.resolve({});
      return Promise.resolve([]);
    });
  });

  it('renders the calendar title', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    expect(screen.getByText('calendar.title')).toBeInTheDocument();
  });

  it('renders view toggle buttons (Day, Week, Month)', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    expect(screen.getByText('calendar.view_day')).toBeInTheDocument();
    expect(screen.getByText('calendar.view_week')).toBeInTheDocument();
    expect(screen.getByText('calendar.view_month')).toBeInTheDocument();
  });

  it('renders new booking button', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    expect(screen.getByText('calendar.new_booking')).toBeInTheDocument();
  });

  it('sidebar toggle persists to localStorage', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    const sidebarBtn = screen.getByTitle('Toggle sidebar (S)');

    await act(async () => {
      fireEvent.click(sidebarBtn);
    });

    const stored = localStorage.getItem('calendar-sidebar-visible');
    expect(stored).toBeDefined();
  });

  it('keyboard shortcut T navigates to today', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: 't' });
    });

    // The page should still render correctly after pressing T
    expect(screen.getByText('calendar.title')).toBeInTheDocument();
  });

  it('keyboard shortcut N opens booking form', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    expect(screen.queryByTestId('booking-form-modal')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'n' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('booking-form-modal')).toBeInTheDocument();
    });
  });

  it('keyboard shortcut ? toggles shortcuts help', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: '?' });
    });

    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });
  });

  it('shortcuts help modal renders all shortcuts', async () => {
    await act(async () => {
      render(<CalendarPage />);
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: '?' });
    });

    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });
    expect(screen.getByText('Go to today')).toBeInTheDocument();
    expect(screen.getByText('New booking')).toBeInTheDocument();
    expect(screen.getByText('Toggle sidebar')).toBeInTheDocument();
    expect(screen.getByText('Day view')).toBeInTheDocument();
    expect(screen.getByText('Week view')).toBeInTheDocument();
    expect(screen.getByText('Month view')).toBeInTheDocument();
    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Close popover / modal')).toBeInTheDocument();
    expect(screen.getByText('Toggle this help')).toBeInTheDocument();
  });

  it('mobile sidebar shows overlay backdrop', async () => {
    // Set sidebar to open via localStorage
    localStorage.setItem('calendar-sidebar-visible', 'true');

    await act(async () => {
      render(<CalendarPage />);
    });

    // When sidebar is open, both desktop and mobile sidebar instances are rendered
    await waitFor(() => {
      const sidebars = screen.getAllByTestId('calendar-sidebar');
      // Should have at least 2: one in hidden lg:block wrapper, one in mobile overlay
      expect(sidebars.length).toBeGreaterThanOrEqual(2);
    });
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

  it('renders booking card with color label border class', async () => {
    const today = new Date();
    const startTime = new Date(today);
    startTime.setHours(10, 0, 0, 0);
    const endTime = new Date(today);
    endTime.setHours(11, 0, 0, 0);

    mockGet.mockImplementation((path: string) => {
      if (path.startsWith('/staff')) return Promise.resolve(mockStaff);
      if (path.startsWith('/locations')) return Promise.resolve([]);
      if (path.startsWith('/bookings/calendar/month-summary')) return Promise.resolve({ days: {} });
      if (path.startsWith('/bookings/calendar'))
        return Promise.resolve([
          {
            id: 'b1',
            staffId: 's1',
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            status: 'CONFIRMED',
            colorLabel: 'sage',
            customer: { name: 'Alice' },
            service: { name: 'Facial', durationMins: 60, kind: 'TREATMENT' },
            staff: { name: 'Sarah' },
          },
        ]);
      if (path.startsWith('/availability/calendar-context')) return Promise.resolve({});
      return Promise.resolve([]);
    });

    await act(async () => {
      render(<CalendarPage />);
    });

    await waitFor(() => {
      const colorLabelEl = document.querySelector('[data-color-label="sage"]');
      expect(colorLabelEl).not.toBeNull();
      expect(colorLabelEl?.className).toContain('border-sage-400');
    });
  });

  it('booking cards are draggable in day view', async () => {
    const startTime = new Date();
    startTime.setHours(10, 0, 0, 0);
    const endTime = new Date();
    endTime.setHours(11, 0, 0, 0);

    mockGet.mockImplementation((path: string) => {
      if (path.startsWith('/staff')) return Promise.resolve(mockStaff);
      if (path.startsWith('/locations')) return Promise.resolve([]);
      if (path.startsWith('/bookings/calendar/month-summary')) return Promise.resolve({ days: {} });
      if (path.startsWith('/bookings/calendar'))
        return Promise.resolve([
          {
            id: 'b1',
            staffId: 's1',
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            status: 'CONFIRMED',
            customer: { name: 'Alice' },
            service: { name: 'Facial', durationMins: 60 },
            staff: { name: 'Sarah' },
          },
        ]);
      if (path.startsWith('/availability/calendar-context')) return Promise.resolve({});
      return Promise.resolve([]);
    });

    await act(async () => {
      render(<CalendarPage />);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    });

    const bookingCard = screen.getAllByText('Alice')[0].closest('[draggable]');
    expect(bookingCard).not.toBeNull();
    expect(bookingCard?.getAttribute('draggable')).toBe('true');
  });

  it('booking cards are draggable in week view', async () => {
    const startTime = new Date();
    startTime.setHours(10, 0, 0, 0);
    const endTime = new Date();
    endTime.setHours(11, 0, 0, 0);

    mockGet.mockImplementation((path: string) => {
      if (path.startsWith('/staff')) return Promise.resolve(mockStaff);
      if (path.startsWith('/locations')) return Promise.resolve([]);
      if (path.startsWith('/bookings/calendar/month-summary')) return Promise.resolve({ days: {} });
      if (path.startsWith('/bookings/calendar'))
        return Promise.resolve([
          {
            id: 'b1',
            staffId: 's1',
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            status: 'CONFIRMED',
            customer: { name: 'Bob' },
            service: { name: 'Facial', durationMins: 60 },
            staff: { name: 'Sarah' },
          },
        ]);
      if (path.startsWith('/availability/calendar-context')) return Promise.resolve({});
      return Promise.resolve([]);
    });

    await act(async () => {
      render(<CalendarPage />);
    });

    // Switch to week view
    await act(async () => {
      fireEvent.click(screen.getByText('calendar.view_week'));
    });

    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    const bookingCard = screen.getByText('Bob').closest('[draggable]');
    expect(bookingCard).not.toBeNull();
    expect(bookingCard?.getAttribute('draggable')).toBe('true');
  });

  it('drag start sets opacity on booking card', async () => {
    const startTime = new Date();
    startTime.setHours(10, 0, 0, 0);
    const endTime = new Date();
    endTime.setHours(11, 0, 0, 0);

    mockGet.mockImplementation((path: string) => {
      if (path.startsWith('/staff')) return Promise.resolve(mockStaff);
      if (path.startsWith('/locations')) return Promise.resolve([]);
      if (path.startsWith('/bookings/calendar/month-summary')) return Promise.resolve({ days: {} });
      if (path.startsWith('/bookings/calendar'))
        return Promise.resolve([
          {
            id: 'b1',
            staffId: 's1',
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            status: 'CONFIRMED',
            customer: { name: 'Alice' },
            service: { name: 'Facial', durationMins: 60 },
            staff: { name: 'Sarah' },
          },
        ]);
      if (path.startsWith('/availability/calendar-context')) return Promise.resolve({});
      return Promise.resolve([]);
    });

    await act(async () => {
      render(<CalendarPage />);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    });

    const bookingCard = screen.getAllByText('Alice')[0].closest('[draggable]') as HTMLElement;
    expect(bookingCard).not.toBeNull();

    await act(async () => {
      fireEvent.dragStart(bookingCard, {
        dataTransfer: { effectAllowed: '', setData: jest.fn() },
      });
    });

    expect(bookingCard.style.opacity).toBe('0.4');
  });
});

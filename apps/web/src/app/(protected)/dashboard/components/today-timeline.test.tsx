const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/api', () => ({
  api: {
    patch: jest.fn(),
  },
}));

jest.mock('lucide-react', () => ({
  Calendar: (props: any) => <div data-testid="calendar-icon" {...props} />,
  Play: (props: any) => <div data-testid="play-icon" {...props} />,
  CheckCircle2: (props: any) => <div data-testid="check-circle-icon" {...props} />,
  UserX: (props: any) => <div data-testid="user-x-icon" {...props} />,
  MessageSquare: (props: any) => <div data-testid="message-square-icon" {...props} />,
  ArrowRight: (props: any) => <div data-testid="arrow-right-icon" {...props} />,
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TodayTimeline } from './today-timeline';
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

// Helper: create a booking at a given hour today
function makeBooking(overrides: any = {}) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(10, 0, 0, 0);
  const end = new Date(now);
  end.setHours(11, 0, 0, 0);
  return {
    id: 'b1',
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    status: 'CONFIRMED',
    customer: { name: 'Jane Doe' },
    service: { name: 'Botox' },
    staff: { name: 'Dr. Chen' },
    conversationId: null,
    ...overrides,
  };
}

describe('TodayTimeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.patch.mockResolvedValue({});
  });

  it('renders empty state when no bookings', () => {
    render(<TodayTimeline todayBookings={[]} />);
    expect(screen.getByTestId('today-timeline')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-empty')).toBeInTheDocument();
  });

  it('renders booking cards with customer and service info', () => {
    render(<TodayTimeline todayBookings={[makeBooking()]} />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(/Botox/)).toBeInTheDocument();
    expect(screen.getByText(/Dr. Chen/)).toBeInTheDocument();
  });

  it('shows start button for confirmed bookings', () => {
    render(<TodayTimeline todayBookings={[makeBooking({ status: 'CONFIRMED' })]} />);
    expect(screen.getByTestId('action-start')).toBeInTheDocument();
  });

  it('shows complete button for in-progress bookings', () => {
    render(<TodayTimeline todayBookings={[makeBooking({ status: 'IN_PROGRESS' })]} />);
    expect(screen.getByTestId('action-complete')).toBeInTheDocument();
  });

  it('does not show action buttons for completed bookings', () => {
    render(<TodayTimeline todayBookings={[makeBooking({ status: 'COMPLETED' })]} />);
    expect(screen.queryByTestId('action-start')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-complete')).not.toBeInTheDocument();
  });

  it('shows chat button when booking has conversationId', () => {
    render(<TodayTimeline todayBookings={[makeBooking({ conversationId: 'conv-1' })]} />);
    expect(screen.getByTestId('action-chat')).toBeInTheDocument();
  });

  it('does not show chat button when no conversationId', () => {
    render(<TodayTimeline todayBookings={[makeBooking({ conversationId: null })]} />);
    expect(screen.queryByTestId('action-chat')).not.toBeInTheDocument();
  });

  it('calls API to update booking status on start click', async () => {
    const onUpdate = jest.fn();
    render(
      <TodayTimeline
        todayBookings={[makeBooking({ id: 'b42', status: 'CONFIRMED' })]}
        onBookingUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByTestId('action-start'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/bookings/b42/status', {
        status: 'IN_PROGRESS',
      });
    });
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  it('shows error toast on status update failure', async () => {
    mockApi.patch.mockRejectedValue(new Error('Network error'));
    render(<TodayTimeline todayBookings={[makeBooking({ status: 'CONFIRMED' })]} />);

    fireEvent.click(screen.getByTestId('action-start'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Network error', 'error');
    });
  });

  it('navigates to inbox on chat button click', () => {
    render(<TodayTimeline todayBookings={[makeBooking({ conversationId: 'conv-99' })]} />);

    fireEvent.click(screen.getByTestId('action-chat'));

    expect(mockPush).toHaveBeenCalledWith('/inbox?conversationId=conv-99');
  });

  it('navigates to calendar on view calendar click', () => {
    render(<TodayTimeline todayBookings={[]} />);

    fireEvent.click(screen.getByText('dashboard.view_calendar'));

    expect(mockPush).toHaveBeenCalledWith('/calendar');
  });

  it('shows multiple booking cards', () => {
    const now = new Date();
    const b1Start = new Date(now);
    b1Start.setHours(9, 0, 0, 0);
    const b1End = new Date(now);
    b1End.setHours(10, 0, 0, 0);
    const b2Start = new Date(now);
    b2Start.setHours(11, 0, 0, 0);
    const b2End = new Date(now);
    b2End.setHours(12, 0, 0, 0);

    render(
      <TodayTimeline
        todayBookings={[
          makeBooking({
            id: 'b1',
            startTime: b1Start.toISOString(),
            endTime: b1End.toISOString(),
            customer: { name: 'Alice' },
          }),
          makeBooking({
            id: 'b2',
            startTime: b2Start.toISOString(),
            endTime: b2End.toISOString(),
            customer: { name: 'Bob' },
          }),
        ]}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-booking')).toHaveLength(2);
  });

  it('renders gap indicators for free time between bookings', () => {
    const now = new Date();
    const b1Start = new Date(now);
    b1Start.setHours(9, 0, 0, 0);
    const b1End = new Date(now);
    b1End.setHours(10, 0, 0, 0);
    const b2Start = new Date(now);
    b2Start.setHours(11, 0, 0, 0); // 1 hour gap
    const b2End = new Date(now);
    b2End.setHours(12, 0, 0, 0);

    render(
      <TodayTimeline
        todayBookings={[
          makeBooking({
            id: 'b1',
            startTime: b1Start.toISOString(),
            endTime: b1End.toISOString(),
          }),
          makeBooking({
            id: 'b2',
            startTime: b2Start.toISOString(),
            endTime: b2End.toISOString(),
          }),
        ]}
      />,
    );

    expect(screen.getByTestId('gap-indicator')).toBeInTheDocument();
    expect(screen.getByText(/free/)).toBeInTheDocument();
  });

  it('renders status badge text', () => {
    render(<TodayTimeline todayBookings={[makeBooking({ status: 'CONFIRMED' })]} />);
    expect(screen.getByText('status.confirmed')).toBeInTheDocument();
  });
});

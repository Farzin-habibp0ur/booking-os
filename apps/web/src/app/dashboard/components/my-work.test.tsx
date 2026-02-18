import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('lucide-react', () => ({
  Calendar: (props: any) => <div data-testid="calendar-icon" {...props} />,
  MessageSquare: (props: any) => <div data-testid="message-icon" {...props} />,
  ArrowRight: (props: any) => <div data-testid="arrow-right" {...props} />,
  CheckCircle2: (props: any) => <div data-testid="check-icon" {...props} />,
}));

import { MyWork } from './my-work';

describe('MyWork', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders null when no bookings, conversations, or completions', () => {
    const { container } = render(
      <MyWork myBookingsToday={[]} myAssignedConversations={[]} completedTodayByStaff={0} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders my schedule with bookings', () => {
    render(
      <MyWork
        myBookingsToday={[
          {
            id: 'b1',
            customer: { name: 'Alice' },
            service: { name: 'Cut' },
            startTime: '2026-02-17T10:00:00Z',
            status: 'CONFIRMED',
          },
        ]}
        myAssignedConversations={[]}
        completedTodayByStaff={0}
      />,
    );

    expect(screen.getByTestId('my-work')).toBeInTheDocument();
    expect(screen.getByText('dashboard.my_schedule')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Cut')).toBeInTheDocument();
  });

  it('renders my conversations when assigned conversations exist', () => {
    render(
      <MyWork
        myBookingsToday={[]}
        myAssignedConversations={[
          { id: 'c1', customer: { name: 'Bob' }, messages: [{ content: 'Need help' }] },
        ]}
        completedTodayByStaff={0}
      />,
    );

    expect(screen.getByText('dashboard.my_conversations')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Need help')).toBeInTheDocument();
  });

  it('shows completed count badge', () => {
    render(
      <MyWork
        myBookingsToday={[
          {
            id: 'b1',
            customer: { name: 'Alice' },
            service: { name: 'Cut' },
            startTime: '2026-02-17T10:00:00Z',
            status: 'CONFIRMED',
          },
        ]}
        myAssignedConversations={[]}
        completedTodayByStaff={5}
      />,
    );

    expect(screen.getByText(/5 dashboard\.completed_label/)).toBeInTheDocument();
  });

  it('shows empty state for schedule when no bookings', () => {
    render(
      <MyWork
        myBookingsToday={[]}
        myAssignedConversations={[{ id: 'c1', customer: { name: 'Bob' }, messages: [] }]}
        completedTodayByStaff={0}
      />,
    );

    expect(screen.getByText('dashboard.no_bookings_scheduled')).toBeInTheDocument();
  });

  it('shows empty state for conversations when none assigned', () => {
    render(
      <MyWork
        myBookingsToday={[
          {
            id: 'b1',
            customer: { name: 'X' },
            service: { name: 'Y' },
            startTime: '2026-02-17T10:00:00Z',
            status: 'CONFIRMED',
          },
        ]}
        myAssignedConversations={[]}
        completedTodayByStaff={0}
      />,
    );

    expect(screen.getByText('dashboard.no_assigned_conversations')).toBeInTheDocument();
  });

  it('navigates to calendar when view calendar clicked', async () => {
    const user = userEvent.setup();
    render(
      <MyWork
        myBookingsToday={[
          {
            id: 'b1',
            customer: { name: 'Alice' },
            service: { name: 'Cut' },
            startTime: '2026-02-17T10:00:00Z',
            status: 'CONFIRMED',
          },
        ]}
        myAssignedConversations={[]}
        completedTodayByStaff={0}
      />,
    );

    await user.click(screen.getByText('dashboard.view_calendar'));
    expect(mockPush).toHaveBeenCalledWith('/calendar');
  });

  it('limits bookings to 5 items', () => {
    const bookings = Array.from({ length: 8 }, (_, i) => ({
      id: `b${i}`,
      customer: { name: `Client ${i}` },
      service: { name: `Svc ${i}` },
      startTime: '2026-02-17T10:00:00Z',
      status: 'CONFIRMED',
    }));

    render(
      <MyWork myBookingsToday={bookings} myAssignedConversations={[]} completedTodayByStaff={0} />,
    );

    // Should show first 5 only
    expect(screen.getByText('Client 0')).toBeInTheDocument();
    expect(screen.getByText('Client 4')).toBeInTheDocument();
    expect(screen.queryByText('Client 5')).not.toBeInTheDocument();
  });
});

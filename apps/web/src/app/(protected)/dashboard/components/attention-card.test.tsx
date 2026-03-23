const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('lucide-react', () => ({
  DollarSign: (props: any) => <div data-testid="dollar-icon" {...props} />,
  MessageSquare: (props: any) => <div data-testid="message-icon" {...props} />,
  Calendar: (props: any) => <div data-testid="calendar-icon" {...props} />,
  ArrowRight: (props: any) => <div data-testid="arrow-right-icon" {...props} />,
  AlertTriangle: (props: any) => <div data-testid="alert-icon" {...props} />,
  ChevronDown: (props: any) => <div data-testid="chevron-down" {...props} />,
  ChevronUp: (props: any) => <div data-testid="chevron-up" {...props} />,
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { AttentionCards } from './attention-card';

const makeBookings = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `b${i}`,
    customer: { name: `Customer ${i}` },
    service: { name: `Service ${i}` },
    startTime: '2026-02-20T10:00:00Z',
  }));

const makeConversations = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    customer: { name: `Contact ${i}` },
    lastMessageAt: new Date(Date.now() - 60000 * (i + 30)).toISOString(),
  }));

describe('AttentionCards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when no attention data', () => {
    const { container } = render(<AttentionCards />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when all lists are empty', () => {
    const { container } = render(
      <AttentionCards
        attentionNeeded={{
          depositPendingBookings: [],
          overdueConversations: [],
          tomorrowBookings: [],
        }}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders deposit pending section', () => {
    render(
      <AttentionCards
        attentionNeeded={{
          depositPendingBookings: makeBookings(2),
          overdueConversations: [],
          tomorrowBookings: [],
        }}
      />,
    );

    expect(screen.getByTestId('attention-cards')).toBeInTheDocument();
    expect(screen.getByText('dashboard.deposit_pending')).toBeInTheDocument();
    expect(screen.getByText('Customer 0')).toBeInTheDocument();
  });

  it('renders send reminders primary action for deposits', () => {
    render(
      <AttentionCards
        attentionNeeded={{
          depositPendingBookings: makeBookings(1),
          overdueConversations: [],
          tomorrowBookings: [],
        }}
      />,
    );

    expect(screen.getByTestId('resolve-deposit')).toBeInTheDocument();
    expect(screen.getByText('dashboard.send_reminders')).toBeInTheDocument();
  });

  it('navigates to first deposit booking on resolve click', () => {
    render(
      <AttentionCards
        attentionNeeded={{
          depositPendingBookings: makeBookings(2),
          overdueConversations: [],
          tomorrowBookings: [],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('resolve-deposit'));
    expect(mockPush).toHaveBeenCalledWith('/bookings?bookingId=b0');
  });

  it('renders open queue primary action for overdue', () => {
    render(
      <AttentionCards
        attentionNeeded={{
          depositPendingBookings: [],
          overdueConversations: makeConversations(1),
          tomorrowBookings: [],
        }}
      />,
    );

    expect(screen.getByTestId('resolve-overdue')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('resolve-overdue'));
    expect(mockPush).toHaveBeenCalledWith('/inbox?conversationId=c0');
  });

  it('renders confirm schedule primary action for tomorrow', () => {
    render(
      <AttentionCards
        attentionNeeded={{
          depositPendingBookings: [],
          overdueConversations: [],
          tomorrowBookings: makeBookings(1),
        }}
      />,
    );

    expect(screen.getByTestId('resolve-tomorrow')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('resolve-tomorrow'));
    expect(mockPush).toHaveBeenCalledWith('/calendar');
  });

  it('shows only 3 items initially when more than 3', () => {
    render(
      <AttentionCards
        attentionNeeded={{
          depositPendingBookings: makeBookings(5),
          overdueConversations: [],
          tomorrowBookings: [],
        }}
      />,
    );

    // Should show first 3
    expect(screen.getByText('Customer 0')).toBeInTheDocument();
    expect(screen.getByText('Customer 1')).toBeInTheDocument();
    expect(screen.getByText('Customer 2')).toBeInTheDocument();
    // Should not show 4th
    expect(screen.queryByText('Customer 3')).not.toBeInTheDocument();
  });

  it('shows toggle button when more than 3 items', () => {
    render(
      <AttentionCards
        attentionNeeded={{
          depositPendingBookings: makeBookings(5),
          overdueConversations: [],
          tomorrowBookings: [],
        }}
      />,
    );

    expect(screen.getByTestId('toggle-deposits')).toBeInTheDocument();
    expect(screen.getByText(/Show all 5/)).toBeInTheDocument();
  });

  it('expands to show all items when toggle clicked', () => {
    render(
      <AttentionCards
        attentionNeeded={{
          depositPendingBookings: makeBookings(5),
          overdueConversations: [],
          tomorrowBookings: [],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('toggle-deposits'));

    expect(screen.getByText('Customer 3')).toBeInTheDocument();
    expect(screen.getByText('Customer 4')).toBeInTheDocument();
    expect(screen.getByText(/Show less/)).toBeInTheDocument();
  });

  it('does not show toggle when 3 or fewer items', () => {
    render(
      <AttentionCards
        attentionNeeded={{
          depositPendingBookings: makeBookings(3),
          overdueConversations: [],
          tomorrowBookings: [],
        }}
      />,
    );

    expect(screen.queryByTestId('toggle-deposits')).not.toBeInTheDocument();
  });
});

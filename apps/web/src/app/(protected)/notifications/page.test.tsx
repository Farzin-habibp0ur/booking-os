const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/notifications',
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => {
  const Link = ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  return Link;
});
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    token: 'test-token',
    loading: false,
  }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/use-socket', () => ({
  useSocket: () => {},
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationsPage from './page';
import type { AppNotification } from '@/components/notification-bell';

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: `notif-${Math.random().toString(36).slice(2, 6)}`,
    type: 'message',
    title: 'Test notification',
    description: 'Test description',
    timestamp: new Date().toISOString(),
    read: false,
    ...overrides,
  };
}

function seed(notifs: AppNotification[]) {
  localStorage.setItem('notifications', JSON.stringify(notifs));
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('renders notifications list from localStorage', () => {
    seed([makeNotification({ title: 'Msg 1' }), makeNotification({ title: 'Msg 2' })]);
    render(<NotificationsPage />);
    expect(screen.getByText('Msg 1')).toBeInTheDocument();
    expect(screen.getByText('Msg 2')).toBeInTheDocument();
  });

  it('shows empty state when no notifications', () => {
    render(<NotificationsPage />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
  });

  it('filters by type', () => {
    seed([
      makeNotification({ title: 'Chat msg', type: 'message' }),
      makeNotification({ title: 'Booking upd', type: 'booking' }),
      makeNotification({ title: 'Action item', type: 'action' }),
    ]);
    render(<NotificationsPage />);

    // All shown by default
    expect(screen.getByText('Chat msg')).toBeInTheDocument();
    expect(screen.getByText('Booking upd')).toBeInTheDocument();
    expect(screen.getByText('Action item')).toBeInTheDocument();

    // Filter to messages only
    fireEvent.click(screen.getByTestId('filter-tab-message'));
    expect(screen.getByText('Chat msg')).toBeInTheDocument();
    expect(screen.queryByText('Booking upd')).not.toBeInTheDocument();
    expect(screen.queryByText('Action item')).not.toBeInTheDocument();

    // Filter to bookings
    fireEvent.click(screen.getByTestId('filter-tab-booking'));
    expect(screen.queryByText('Chat msg')).not.toBeInTheDocument();
    expect(screen.getByText('Booking upd')).toBeInTheDocument();
  });

  it('marks notification as read on click', () => {
    seed([makeNotification({ title: 'Unread one', href: '/inbox' })]);
    render(<NotificationsPage />);
    expect(screen.getByTestId('unread-indicator')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Unread one'));
    expect(mockPush).toHaveBeenCalledWith('/inbox');
    // After re-render, indicator should be gone
    expect(screen.queryByTestId('unread-indicator')).not.toBeInTheDocument();
  });

  it('"Mark all as read" button works', () => {
    seed([makeNotification(), makeNotification()]);
    render(<NotificationsPage />);
    expect(screen.getAllByTestId('unread-indicator')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('mark-all-read-btn'));
    expect(screen.queryAllByTestId('unread-indicator')).toHaveLength(0);
  });

  it('"Clear all" button works', () => {
    seed([makeNotification({ title: 'Gone soon' })]);
    render(<NotificationsPage />);
    expect(screen.getByText('Gone soon')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('clear-all-btn'));
    expect(screen.queryByText('Gone soon')).not.toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows filtered empty state text', () => {
    render(<NotificationsPage />);
    fireEvent.click(screen.getByTestId('filter-tab-action'));
    expect(screen.getByText('No action notifications')).toBeInTheDocument();
  });
});

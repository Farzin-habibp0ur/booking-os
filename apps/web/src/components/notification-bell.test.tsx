const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => {
  const Link = ({ children, href, onClick, ...rest }: any) => (
    <a
      href={href}
      onClick={(e: any) => {
        if (onClick) onClick(e);
      }}
      {...rest}
    >
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

const socketHandlers: Record<string, (...args: any[]) => void> = {};
jest.mock('@/lib/use-socket', () => ({
  useSocket: (events: Record<string, (...args: any[]) => void>) => {
    Object.assign(socketHandlers, events);
  },
}));

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import NotificationBell, { AppNotification } from './notification-bell';

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

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k]);
  });

  it('renders bell icon', () => {
    render(<NotificationBell />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('shows badge with unread count', () => {
    const notifs = [makeNotification(), makeNotification()];
    localStorage.setItem('notifications', JSON.stringify(notifs));
    render(<NotificationBell />);
    const badge = screen.getByTestId('notification-badge');
    expect(badge).toHaveTextContent('2');
  });

  it('hides badge when no unread notifications', () => {
    const notifs = [makeNotification({ read: true })];
    localStorage.setItem('notifications', JSON.stringify(notifs));
    render(<NotificationBell />);
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(<NotificationBell />);
    expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();
  });

  it('shows notifications from localStorage', () => {
    const notifs = [makeNotification({ title: 'First' }), makeNotification({ title: 'Second' })];
    localStorage.setItem('notifications', JSON.stringify(notifs));
    render(<NotificationBell />);
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('marks all as read', () => {
    const notifs = [makeNotification(), makeNotification()];
    localStorage.setItem('notifications', JSON.stringify(notifs));
    render(<NotificationBell />);
    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByTestId('mark-all-read'));
    // Badge should disappear
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
    // Unread dots should disappear
    expect(screen.queryAllByTestId('unread-dot')).toHaveLength(0);
  });

  it('closes on Escape', () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument();
  });

  it('has a "View all" link to /notifications', () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByTestId('notification-bell'));
    const link = screen.getByTestId('view-all-link');
    expect(link).toHaveAttribute('href', '/notifications');
  });

  it('adds notification on message:new socket event', () => {
    render(<NotificationBell />);
    act(() => {
      socketHandlers['message:new']?.({
        customerName: 'Jane Doe',
      });
    });
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByText('New message from Jane Doe')).toBeInTheDocument();
  });

  it('adds notification on booking:updated socket event', () => {
    render(<NotificationBell />);
    act(() => {
      socketHandlers['booking:updated']?.({
        customerName: 'Alice',
        serviceName: 'Facial',
      });
    });
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByText('Booking updated: Alice — Facial')).toBeInTheDocument();
  });

  it('adds notification on action-card:created socket event', () => {
    render(<NotificationBell />);
    act(() => {
      socketHandlers['action-card:created']?.({});
    });
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByText('New action card created')).toBeInTheDocument();
  });

  it('navigates and marks read when notification clicked', () => {
    const notifs = [makeNotification({ title: 'Click me', href: '/inbox' })];
    localStorage.setItem('notifications', JSON.stringify(notifs));
    render(<NotificationBell />);
    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByText('Click me'));
    expect(mockPush).toHaveBeenCalledWith('/inbox');
  });
});

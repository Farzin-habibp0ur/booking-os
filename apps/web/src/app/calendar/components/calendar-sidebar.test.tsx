jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));
jest.mock('@/lib/design-tokens', () => ({
  ELEVATION: { dropdown: '' },
  BOOKING_STATUS_STYLES: {
    PENDING: { bg: '', text: '', dot: '', label: 'Pending' },
  },
}));

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { CalendarSidebar } from './calendar-sidebar';

const mockDate = new Date('2027-01-15T12:00:00');

const mockSummary = {
  totalBookings: 8,
  confirmedBookings: 5,
  revenue: 1200,
  gaps: 2,
  noShows: 1,
  avgDuration: 45,
};

const mockWaitlist = {
  data: [
    { id: 'w1', customerName: 'Alice', serviceName: 'Botox', preferredDate: '2027-01-16', status: 'pending' },
    { id: 'w2', customerName: 'Bob', serviceName: 'Facial', preferredDate: '2027-01-17', status: 'pending' },
  ],
};

const mockActions = [
  { id: 'a1', title: 'Fill gap at 2pm', description: 'Contact waitlisted clients', type: 'gap_fill' },
  { id: 'a2', title: 'Follow up no-show', description: 'Reach out to missed appointment', type: 'follow_up' },
];

function setupMocks({
  summary = mockSummary,
  waitlist = mockWaitlist,
  actions = mockActions,
  rejectAll = false,
}: {
  summary?: any;
  waitlist?: any;
  actions?: any;
  rejectAll?: boolean;
} = {}) {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    if (rejectAll) return Promise.reject(new Error('Network error'));
    if (url.includes('/analytics/daily-summary')) return Promise.resolve(summary);
    if (url.includes('/waitlist')) return Promise.resolve(waitlist);
    if (url.includes('/briefing/actions')) return Promise.resolve(actions);
    return Promise.resolve(null);
  });
}

describe('CalendarSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders date header', () => {
    setupMocks();
    render(<CalendarSidebar currentDate={mockDate} onClose={jest.fn()} />);
    // The date is formatted as weekday, month short, day numeric
    const dateLabel = mockDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    expect(screen.getByText(dateLabel)).toBeInTheDocument();
  });

  it('displays summary metrics when loaded', async () => {
    setupMocks();
    render(<CalendarSidebar currentDate={mockDate} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('5/8')).toBeInTheDocument();
    });
    expect(screen.getByText('$1,200')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('displays waitlist entries', async () => {
    setupMocks();
    render(<CalendarSidebar currentDate={mockDate} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    expect(screen.getByText('Botox')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Facial')).toBeInTheDocument();
  });

  it('displays AI actions', async () => {
    setupMocks();
    render(<CalendarSidebar currentDate={mockDate} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Fill gap at 2pm')).toBeInTheDocument();
    });
    expect(screen.getByText('Contact waitlisted clients')).toBeInTheDocument();
    expect(screen.getByText('Follow up no-show')).toBeInTheDocument();
  });

  it('calls onClose when X button clicked', async () => {
    setupMocks();
    const onClose = jest.fn();
    render(<CalendarSidebar currentDate={mockDate} onClose={onClose} />);

    const closeBtn = screen.getByLabelText('Close sidebar');
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    setupMocks({ rejectAll: true });
    const { container } = render(
      <CalendarSidebar currentDate={mockDate} onClose={jest.fn()} />,
    );

    // Should still render the header without crashing
    await waitFor(() => {
      const dateLabel = mockDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      expect(screen.getByText(dateLabel)).toBeInTheDocument();
    });
    expect(container).toBeTruthy();
  });

  it('renders avg service time in quick stats', async () => {
    setupMocks();
    render(<CalendarSidebar currentDate={mockDate} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Avg service time: 45 min')).toBeInTheDocument();
    });
  });
});

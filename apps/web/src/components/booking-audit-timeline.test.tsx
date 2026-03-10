jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
    upload: jest.fn(),
    getText: jest.fn(),
  },
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));

import { render, screen, waitFor } from '@testing-library/react';
import { api } from '@/lib/api';
import BookingAuditTimeline from './booking-audit-timeline';

const mockApi = api as jest.Mocked<typeof api>;

describe('BookingAuditTimeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading skeleton initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {})); // never resolves
    render(<BookingAuditTimeline bookingId="b1" />);

    expect(screen.getByTestId('audit-timeline-loading')).toBeTruthy();
  });

  it('shows empty state when no entries', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<BookingAuditTimeline bookingId="b1" />);

    await waitFor(() => {
      expect(screen.getByTestId('audit-timeline-empty')).toBeTruthy();
    });
    expect(screen.getByText('No activity recorded yet')).toBeTruthy();
  });

  it('renders audit entries with actor name and description', async () => {
    const entries = [
      {
        id: 'a1',
        bookingId: 'b1',
        businessId: 'biz1',
        userId: 'staff1',
        userName: 'Sarah',
        action: 'STATUS_CHANGED',
        changes: [{ field: 'status', from: 'CONFIRMED', to: 'IN_PROGRESS' }],
        ipAddress: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'a2',
        bookingId: 'b1',
        businessId: 'biz1',
        userId: 'staff1',
        userName: 'Sarah',
        action: 'CREATED',
        changes: [{ field: 'status', to: 'CONFIRMED' }],
        ipAddress: null,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];
    mockApi.get.mockResolvedValue(entries);

    render(<BookingAuditTimeline bookingId="b1" />);

    await waitFor(() => {
      expect(screen.getByTestId('audit-timeline')).toBeTruthy();
    });

    const entryElements = screen.getAllByTestId('audit-entry');
    expect(entryElements).toHaveLength(2);
    expect(screen.getByText('Status changed from CONFIRMED to IN_PROGRESS')).toBeTruthy();
    expect(screen.getByText('Booking created')).toBeTruthy();
  });

  it('renders CANCELLED entries', async () => {
    mockApi.get.mockResolvedValue([
      {
        id: 'a1',
        bookingId: 'b1',
        businessId: 'biz1',
        userId: null,
        userName: 'Admin',
        action: 'CANCELLED',
        changes: [{ field: 'status', from: 'CONFIRMED', to: 'CANCELLED' }],
        ipAddress: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    render(<BookingAuditTimeline bookingId="b1" />);

    await waitFor(() => {
      expect(screen.getByText('Booking cancelled')).toBeTruthy();
    });
  });

  it('renders RESCHEDULED entries with time info', async () => {
    mockApi.get.mockResolvedValue([
      {
        id: 'a1',
        bookingId: 'b1',
        businessId: 'biz1',
        userId: null,
        userName: 'System',
        action: 'RESCHEDULED',
        changes: [{ field: 'startTime', from: '2026-03-01T10:00:00Z', to: '2026-03-02T14:00:00Z' }],
        ipAddress: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    render(<BookingAuditTimeline bookingId="b1" />);

    await waitFor(() => {
      expect(screen.getByText(/Rescheduled from/)).toBeTruthy();
    });
  });

  it('renders UPDATED entries with field changes', async () => {
    mockApi.get.mockResolvedValue([
      {
        id: 'a1',
        bookingId: 'b1',
        businessId: 'biz1',
        userId: null,
        userName: 'Admin',
        action: 'UPDATED',
        changes: [{ field: 'notes', from: 'Old', to: 'New' }],
        ipAddress: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    render(<BookingAuditTimeline bookingId="b1" />);

    await waitFor(() => {
      expect(screen.getByText('Notes changed from Old to New')).toBeTruthy();
    });
  });

  it('fetches from correct endpoint', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<BookingAuditTimeline bookingId="booking-123" />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/bookings/booking-123/audit-log');
    });
  });

  it('handles API error gracefully', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));
    render(<BookingAuditTimeline bookingId="b1" />);

    await waitFor(() => {
      expect(screen.getByTestId('audit-timeline-empty')).toBeTruthy();
    });
  });
});

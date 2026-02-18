import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import BookingDetailModal from './booking-detail-modal';

// ─── Mocks ──────────────────────────────────────────────────────────────

let mockUserRole = 'ADMIN';

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: mockUserRole, businessId: 'b1' },
    loading: false,
  }),
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        'recurring.recurring_badge': 'Recurring',
        'recurring.cancel_scope_title': 'Cancel Recurring',
        'recurring.cancel_this_only': 'This appointment only',
        'recurring.cancel_this_and_future': 'This and future',
        'recurring.cancel_all': 'All appointments',
        'override.confirm_without_deposit': 'Confirm Without Deposit',
        'override.cancel_within_policy': 'Override Policy & Cancel',
        'override.title': 'Admin Override',
        'override.warning': 'This action requires admin approval.',
        'override.reason_label': 'Reason for override',
        'override.reason_placeholder': 'Explain why...',
        'override.reason_required': 'Must be at least 5 chars',
        'override.contact_admin': 'Contact an admin',
        'policy.cancellation_blocked': 'Cancellation blocked',
        'policy.reschedule_blocked': 'Reschedule blocked',
        'common.back': 'Back',
        'common.loading': 'Loading...',
        'booking.deposit_sent_success': 'Deposit request sent',
        'booking.deposit_send_error': 'Failed to send deposit',
        'booking.sending_deposit': 'Sending...',
        'booking.send_deposit_request': 'Send Deposit Request',
        'booking.send_reschedule_link': 'Send Reschedule Link',
        'booking.send_cancel_link': 'Send Cancel Link',
        'booking.link_sent': 'Link Sent',
        'booking.link_already_sent': 'Already Sent',
        'timeline.deposit_override': 'Deposit Override',
        'timeline.policy_override': 'Policy Override',
        'timeline.override_reason': `Reason: ${vars?.reason || ''}`,
        'timeline.reschedule_link_sent': 'Reschedule link sent',
        'timeline.cancel_link_sent': 'Cancel link sent',
        'timeline.rescheduled_by_customer': 'Rescheduled by customer',
        'timeline.cancelled_by_customer': 'Cancelled by customer',
        'timeline.notification_confirmation': 'Confirmation sent',
        'timeline.notification_reminder': 'Reminder sent',
        'booking.deposit_request_sent': 'Deposit request sent',
      };
      return map[key] || key;
    },
  }),
}));

const mockGet = jest.fn().mockResolvedValue({ allowed: true });
const mockPost = jest.fn().mockResolvedValue({});
const mockPatch = jest.fn().mockResolvedValue({});

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}));

const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/lib/use-focus-trap', () => ({
  useFocusTrap: jest.fn(),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// ─── Test data ──────────────────────────────────────────────────────────

const mockBooking = {
  id: 'b1',
  status: 'CONFIRMED',
  startTime: '2026-03-15T10:00:00Z',
  endTime: '2026-03-15T11:00:00Z',
  createdAt: '2026-03-10T08:00:00Z',
  updatedAt: '2026-03-10T08:00:00Z',
  service: { id: 's1', name: 'Hydra Facial', durationMins: 60, price: 150, kind: 'TREATMENT' },
  staff: { id: 'st1', name: 'Jane D.' },
  customer: { name: 'Alice Smith', phone: '+1234567890' },
  notes: 'Allergic to salicylic acid',
  customFields: {},
};

const defaultProps = {
  booking: mockBooking,
  isOpen: true,
  onClose: jest.fn(),
  onUpdated: jest.fn(),
  onReschedule: jest.fn(),
};

// ─── Tests ──────────────────────────────────────────────────────────────

describe('BookingDetailModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRole = 'ADMIN';
    mockGet.mockResolvedValue({ allowed: true });
  });

  // ─── Render / visibility ──────────────────────────────────────────

  test('renders nothing when no booking', () => {
    const { container } = render(<BookingDetailModal {...defaultProps} booking={null} />);
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  test('renders nothing when not open', () => {
    const { container } = render(<BookingDetailModal {...defaultProps} isOpen={false} />);
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  test('renders modal with booking details', () => {
    render(<BookingDetailModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // ─── Customer info ────────────────────────────────────────────────

  test('shows customer name and phone', () => {
    render(<BookingDetailModal {...defaultProps} />);
    // Customer name appears in both the header and the customer section
    expect(screen.getAllByText('Alice Smith').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('+1234567890')).toBeInTheDocument();
  });

  // ─── Service info ─────────────────────────────────────────────────

  test('shows service name and details', () => {
    render(<BookingDetailModal {...defaultProps} />);
    expect(screen.getByText('Hydra Facial')).toBeInTheDocument();
    expect(screen.getByText(/60 min/)).toBeInTheDocument();
    expect(screen.getByText(/\$150/)).toBeInTheDocument();
  });

  // ─── Status badge ─────────────────────────────────────────────────

  test('shows status badge for confirmed booking', () => {
    render(<BookingDetailModal {...defaultProps} />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  test('shows correct status for cancelled booking', () => {
    render(
      <BookingDetailModal {...defaultProps} booking={{ ...mockBooking, status: 'CANCELLED' }} />,
    );
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  // ─── Staff name ───────────────────────────────────────────────────

  test('shows staff name', () => {
    render(<BookingDetailModal {...defaultProps} />);
    expect(screen.getByText('Jane D.')).toBeInTheDocument();
  });

  test('shows "Any" when staff is null', () => {
    render(<BookingDetailModal {...defaultProps} booking={{ ...mockBooking, staff: null }} />);
    expect(screen.getByText('Any')).toBeInTheDocument();
  });

  // ─── Close button ─────────────────────────────────────────────────

  test('close button calls onClose', () => {
    render(<BookingDetailModal {...defaultProps} />);
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // ─── Actions ──────────────────────────────────────────────────────

  test('shows action buttons for confirmed booking', () => {
    render(<BookingDetailModal {...defaultProps} />);
    expect(screen.getByText('Start Visit')).toBeInTheDocument();
    expect(screen.getByText('No Show')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  test('cancel action shows confirmation dialog', async () => {
    render(<BookingDetailModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.getByText('Cancel this booking?')).toBeInTheDocument();
    });
  });

  // ─── Reschedule button ────────────────────────────────────────────

  test('reschedule button calls onReschedule', () => {
    render(<BookingDetailModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Reschedule'));
    expect(defaultProps.onReschedule).toHaveBeenCalledWith(mockBooking);
  });

  // ─── Notes ────────────────────────────────────────────────────────

  test('shows notes section when notes are present', () => {
    render(<BookingDetailModal {...defaultProps} />);
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Allergic to salicylic acid')).toBeInTheDocument();
  });

  test('hides notes section when notes are absent', () => {
    render(<BookingDetailModal {...defaultProps} booking={{ ...mockBooking, notes: null }} />);
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
  });

  // ─── Timeline ─────────────────────────────────────────────────────

  test('shows timeline section', () => {
    render(<BookingDetailModal {...defaultProps} />);
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText(/Created/)).toBeInTheDocument();
  });

  // ─── Error Toast Tests ─────────────────────────────────────────────

  test('shows error toast when status update fails', async () => {
    mockPatch.mockRejectedValueOnce(new Error('Update failed'));

    render(<BookingDetailModal {...defaultProps} />);

    // Click "Start Visit" to trigger IN_PROGRESS status update
    fireEvent.click(screen.getByText('Start Visit'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  test('shows error toast when no-show confirmation fails', async () => {
    mockPatch.mockRejectedValueOnce(new Error('Update failed'));

    render(<BookingDetailModal {...defaultProps} />);

    // Click "No Show" to open confirmation dialog
    fireEvent.click(screen.getByText('No Show'));

    await waitFor(() => {
      expect(screen.getByText('Mark as no-show?')).toBeInTheDocument();
    });

    // The confirm button in the dialog has the action label "No Show"
    // It's in the confirm overlay alongside "Go back"
    // Find the button that is a sibling of "Go back"
    const goBackBtn = screen.getByText('Go back');
    const confirmBtn = goBackBtn.parentElement!.querySelector('button:last-child')!;
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/bookings/b1/status', { status: 'NO_SHOW' });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  test('shows error toast when send deposit request fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('Deposit send failed'));

    render(
      <BookingDetailModal
        {...defaultProps}
        booking={{ ...mockBooking, status: 'PENDING_DEPOSIT' }}
      />,
    );

    fireEvent.click(screen.getByText('Send Deposit Request'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });
});

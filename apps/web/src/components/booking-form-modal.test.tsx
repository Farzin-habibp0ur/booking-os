import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BookingFormModal from './booking-form-modal';

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
        'recurring.repeat_booking': 'Repeat booking',
        'recurring.days_of_week': 'Days of week',
        'recurring.frequency': 'Frequency',
        'recurring.every_week': 'Every week',
        'recurring.every_2_weeks': 'Every 2 weeks',
        'recurring.every_3_weeks': 'Every 3 weeks',
        'recurring.every_4_weeks': 'Every 4 weeks',
        'recurring.ends': 'Ends',
        'recurring.after_occurrences': `After ${vars?.count || ''} occurrences`,
        'recurring.on_date': 'On date',
      };
      return map[key] || key;
    },
  }),
}));

const mockGet = jest.fn().mockResolvedValue([]);
const mockPost = jest.fn().mockResolvedValue({ id: 'b1' });
const mockPatch = jest.fn().mockResolvedValue({ id: 'b1' });

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

// ─── Helpers ────────────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  onCreated: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUserRole = 'ADMIN';
  mockGet.mockResolvedValue([]);
});

// ─── Tests ──────────────────────────────────────────────────────────────

describe('BookingFormModal — VIP Override', () => {
  it('shows VIP Override toggle for ADMIN users', () => {
    render(<BookingFormModal {...defaultProps} />);
    expect(screen.getByText('VIP Override')).toBeInTheDocument();
  });

  it('shows VIP Override toggle for SUPER_ADMIN users', () => {
    mockUserRole = 'SUPER_ADMIN';
    render(<BookingFormModal {...defaultProps} />);
    expect(screen.getByText('VIP Override')).toBeInTheDocument();
  });

  it('does NOT show VIP Override toggle for SERVICE_PROVIDER users', () => {
    mockUserRole = 'SERVICE_PROVIDER';
    render(<BookingFormModal {...defaultProps} />);
    expect(screen.queryByText('VIP Override')).not.toBeInTheDocument();
  });

  it('does NOT show VIP Override toggle for AGENT users', () => {
    mockUserRole = 'AGENT';
    render(<BookingFormModal {...defaultProps} />);
    expect(screen.queryByText('VIP Override')).not.toBeInTheDocument();
  });

  it('shows warning message when VIP Override is checked', () => {
    render(<BookingFormModal {...defaultProps} />);
    const checkbox = screen.getByText('VIP Override').closest('label')!.querySelector('input')!;
    fireEvent.click(checkbox);
    expect(
      screen.getByText(/skip conflict detection and allow double-booking/),
    ).toBeInTheDocument();
  });

  it('shows reason input when VIP Override is checked', () => {
    render(<BookingFormModal {...defaultProps} />);
    const checkbox = screen.getByText('VIP Override').closest('label')!.querySelector('input')!;
    fireEvent.click(checkbox);
    expect(screen.getByPlaceholderText(/Reason for override/)).toBeInTheDocument();
  });

  it('hides warning and reason when VIP Override is unchecked', () => {
    render(<BookingFormModal {...defaultProps} />);
    const checkbox = screen.getByText('VIP Override').closest('label')!.querySelector('input')!;
    fireEvent.click(checkbox); // check
    fireEvent.click(checkbox); // uncheck
    expect(
      screen.queryByText(/skip conflict detection and allow double-booking/),
    ).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Reason for override/)).not.toBeInTheDocument();
  });

  it('does NOT show VIP Override in reschedule mode', () => {
    render(
      <BookingFormModal
        {...defaultProps}
        rescheduleBookingId="b1"
        rescheduleData={{ serviceId: 'svc1', notes: '' }}
      />,
    );
    expect(screen.queryByText('VIP Override')).not.toBeInTheDocument();
  });

  it('resets VIP Override state when modal reopens', () => {
    const { rerender } = render(<BookingFormModal {...defaultProps} />);
    const checkbox = screen.getByText('VIP Override').closest('label')!.querySelector('input')!;
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // Close and reopen
    rerender(<BookingFormModal {...defaultProps} isOpen={false} />);
    rerender(<BookingFormModal {...defaultProps} isOpen={true} />);

    const newCheckbox = screen.getByText('VIP Override').closest('label')!.querySelector('input')!;
    expect(newCheckbox).not.toBeChecked();
  });
});

describe('BookingFormModal — Error Toasts', () => {
  it('shows error toast when services API fails on load', async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === '/services') return Promise.reject(new Error('Network error'));
      return Promise.resolve([]);
    });

    render(<BookingFormModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  it('shows error toast when staff API fails on load', async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === '/staff') return Promise.reject(new Error('Network error'));
      return Promise.resolve([]);
    });

    render(<BookingFormModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  it('shows error toast when customers API fails on load', async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === '/customers?pageSize=100') return Promise.reject(new Error('Network error'));
      return Promise.resolve([]);
    });

    render(<BookingFormModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });
});

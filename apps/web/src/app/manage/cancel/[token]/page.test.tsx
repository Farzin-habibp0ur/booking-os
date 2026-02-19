import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CancelPage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ token: 'test-token-123' }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/components/self-serve-error', () => ({
  SelfServeError: (props: any) => (
    <div data-testid="self-serve-error">
      <span>{props.title}</span>
      <span>{props.message}</span>
    </div>
  ),
}));

const mockPublicApi = {
  get: jest.fn(),
  post: jest.fn(),
};
jest.mock('@/lib/public-api', () => ({
  publicApi: {
    get: (...args: any[]) => mockPublicApi.get(...args),
    post: (...args: any[]) => mockPublicApi.post(...args),
  },
}));

const mockBookingData = {
  booking: {
    id: 'b1',
    status: 'CONFIRMED',
    startTime: '2026-03-15T10:00:00Z',
    endTime: '2026-03-15T11:00:00Z',
    service: { id: 's1', name: 'Deep Facial', durationMins: 60, price: 120 },
    staff: { id: 'st1', name: 'Jane D.' },
    customer: { name: 'Alice Smith' },
  },
  business: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic' },
  policyText: 'Cancellations within 24 hours may incur a fee.',
};

// Helper: waits for confirm state and returns the cancel button
async function waitForConfirmState() {
  await waitFor(() => {
    expect(screen.getByText('Appointment Details')).toBeInTheDocument();
  });
  // The button is the one with text "Cancel Appointment" that is not the heading
  const buttons = screen.getAllByText('Cancel Appointment');
  // The button is the <button> element
  return buttons.find((el) => el.tagName === 'BUTTON')!;
}

describe('CancelPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Loading ────────────────────────────────────────────────────────

  test('shows loading state initially', () => {
    mockPublicApi.get.mockReturnValue(new Promise(() => {})); // never resolves
    render(<CancelPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // ─── Confirm state ─────────────────────────────────────────────────

  test('renders booking details after loading', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    render(<CancelPage />);
    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
      expect(screen.getByText('Deep Facial')).toBeInTheDocument();
    });
  });

  test('shows business name', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    render(<CancelPage />);
    await waitFor(() => {
      expect(screen.getByText('Glow Clinic')).toBeInTheDocument();
    });
  });

  test('shows staff name', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    render(<CancelPage />);
    await waitFor(() => {
      expect(screen.getByText('Jane D.')).toBeInTheDocument();
    });
  });

  test('displays policy text when present', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    render(<CancelPage />);
    await waitFor(() => {
      expect(
        screen.getByText('Cancellations within 24 hours may incur a fee.'),
      ).toBeInTheDocument();
    });
  });

  // ─── Two-step cancel flow ──────────────────────────────────────────

  test('cancel button shows confirmation dialog', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    render(<CancelPage />);
    const cancelBtn = await waitForConfirmState();

    fireEvent.click(cancelBtn);

    expect(screen.getByText('Are you sure you want to cancel?')).toBeInTheDocument();
    expect(screen.getByText('Yes, Cancel')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  test('"Go Back" hides confirmation dialog', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    render(<CancelPage />);
    const cancelBtn = await waitForConfirmState();

    fireEvent.click(cancelBtn);
    expect(screen.getByText('Yes, Cancel')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Go Back'));
    expect(screen.queryByText('Yes, Cancel')).not.toBeInTheDocument();
  });

  test('"Yes, Cancel" calls the cancel API', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    mockPublicApi.post.mockResolvedValue({});
    render(<CancelPage />);
    const cancelBtn = await waitForConfirmState();

    fireEvent.click(cancelBtn);
    fireEvent.click(screen.getByText('Yes, Cancel'));

    await waitFor(() => {
      expect(mockPublicApi.post).toHaveBeenCalledWith('/self-serve/cancel/test-token-123', {
        reason: undefined,
      });
    });
  });

  // ─── Submitting state ──────────────────────────────────────────────

  test('shows submitting state while cancelling', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    mockPublicApi.post.mockReturnValue(new Promise(() => {})); // never resolves
    render(<CancelPage />);
    const cancelBtn = await waitForConfirmState();

    fireEvent.click(cancelBtn);
    fireEvent.click(screen.getByText('Yes, Cancel'));

    await waitFor(() => {
      expect(screen.getByText('Cancelling...')).toBeInTheDocument();
    });
  });

  // ─── Success state ─────────────────────────────────────────────────

  test('shows success state after cancellation', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    mockPublicApi.post.mockResolvedValue({});
    render(<CancelPage />);
    const cancelBtn = await waitForConfirmState();

    fireEvent.click(cancelBtn);
    fireEvent.click(screen.getByText('Yes, Cancel'));

    await waitFor(() => {
      expect(screen.getByText('Appointment Cancelled')).toBeInTheDocument();
      expect(screen.getByText(/Deep Facial/)).toBeInTheDocument();
    });
  });

  test('shows "What happens next" on success', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    mockPublicApi.post.mockResolvedValue({});
    render(<CancelPage />);
    const cancelBtn = await waitForConfirmState();

    fireEvent.click(cancelBtn);
    fireEvent.click(screen.getByText('Yes, Cancel'));

    await waitFor(() => {
      expect(screen.getByTestId('what-happens-next')).toBeInTheDocument();
      expect(screen.getByText(/time slot has been released/)).toBeInTheDocument();
    });
  });

  test('shows Book Again link on success when slug available', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    mockPublicApi.post.mockResolvedValue({});
    render(<CancelPage />);
    const cancelBtn = await waitForConfirmState();

    fireEvent.click(cancelBtn);
    fireEvent.click(screen.getByText('Yes, Cancel'));

    await waitFor(() => {
      const link = screen.getByText('Book Again');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', '/book/glow-clinic');
    });
  });

  // ─── Error state ───────────────────────────────────────────────────

  test('shows error when token is invalid', async () => {
    mockPublicApi.get.mockRejectedValue(new Error('Token has expired'));
    render(<CancelPage />);
    await waitFor(() => {
      expect(screen.getByText('Unable to Cancel')).toBeInTheDocument();
      expect(screen.getByText('Token has expired')).toBeInTheDocument();
    });
  });

  test('shows error when cancellation fails', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    mockPublicApi.post.mockRejectedValue(new Error('Already cancelled'));
    render(<CancelPage />);
    const cancelBtn = await waitForConfirmState();

    fireEvent.click(cancelBtn);
    fireEvent.click(screen.getByText('Yes, Cancel'));

    await waitFor(() => {
      expect(screen.getByText('Unable to Cancel')).toBeInTheDocument();
      expect(screen.getByText('Already cancelled')).toBeInTheDocument();
    });
  });
});

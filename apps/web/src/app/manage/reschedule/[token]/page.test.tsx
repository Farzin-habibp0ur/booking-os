import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReschedulePage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ token: 'test-token-123' }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));

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
    service: { id: 's1', name: 'Hydra Facial', durationMins: 60, price: 150 },
    staff: { id: 'st1', name: 'Jane D.' },
    customer: { name: 'Alice Smith' },
  },
  business: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic' },
  policyText: 'Rescheduling within 24 hours may not be possible.',
};

const mockSlots = [
  { time: '2026-03-20T09:00:00Z', display: '9:00 AM', staffId: 'st1', staffName: 'Jane D.', available: true },
  { time: '2026-03-20T10:00:00Z', display: '10:00 AM', staffId: 'st1', staffName: 'Jane D.', available: true },
  { time: '2026-03-20T11:00:00Z', display: '11:00 AM', staffId: 'st2', staffName: 'Bob R.', available: true },
];

describe('ReschedulePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Loading ────────────────────────────────────────────────────────

  test('shows loading state initially', () => {
    mockPublicApi.get.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ReschedulePage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // ─── Select state ──────────────────────────────────────────────────

  test('renders booking details after loading', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    render(<ReschedulePage />);
    await waitFor(() => {
      expect(screen.getByText('Reschedule Appointment')).toBeInTheDocument();
      expect(screen.getByText('Hydra Facial')).toBeInTheDocument();
    });
  });

  test('shows business name', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    render(<ReschedulePage />);
    await waitFor(() => {
      expect(screen.getByText('Glow Clinic')).toBeInTheDocument();
    });
  });

  test('date picker renders with date buttons', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    render(<ReschedulePage />);
    await waitFor(() => {
      expect(screen.getByText('Select a new date')).toBeInTheDocument();
    });
    // The date picker generates 30 buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(30);
  });

  test('clicking a date loads time slots', async () => {
    mockPublicApi.get
      .mockResolvedValueOnce(mockBookingData) // initial validation
      .mockResolvedValueOnce(mockSlots); // availability fetch
    render(<ReschedulePage />);
    await waitFor(() => screen.getByText('Select a new date'));

    // Click the first date button
    const dateButtons = screen.getAllByRole('button');
    fireEvent.click(dateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('9:00 AM')).toBeInTheDocument();
      expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      expect(screen.getByText('11:00 AM')).toBeInTheDocument();
    });
  });

  test('shows time slots with staff names', async () => {
    mockPublicApi.get
      .mockResolvedValueOnce(mockBookingData)
      .mockResolvedValueOnce(mockSlots);
    render(<ReschedulePage />);
    await waitFor(() => screen.getByText('Select a new date'));

    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => {
      // Jane D. appears in the booking summary AND in two slot buttons
      expect(screen.getAllByText('Jane D.').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Bob R.')).toBeInTheDocument();
    });
  });

  test('selecting a slot shows confirm button', async () => {
    mockPublicApi.get
      .mockResolvedValueOnce(mockBookingData)
      .mockResolvedValueOnce(mockSlots);
    render(<ReschedulePage />);
    await waitFor(() => screen.getByText('Select a new date'));

    fireEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() => screen.getByText('9:00 AM'));

    fireEvent.click(screen.getByText('9:00 AM'));

    expect(screen.getByText('Confirm New Time')).toBeInTheDocument();
  });

  test('confirm calls the reschedule API', async () => {
    mockPublicApi.get
      .mockResolvedValueOnce(mockBookingData)
      .mockResolvedValueOnce(mockSlots);
    mockPublicApi.post.mockResolvedValue({});
    render(<ReschedulePage />);
    await waitFor(() => screen.getByText('Select a new date'));

    fireEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() => screen.getByText('9:00 AM'));

    fireEvent.click(screen.getByText('9:00 AM'));
    fireEvent.click(screen.getByText('Confirm New Time'));

    await waitFor(() => {
      expect(mockPublicApi.post).toHaveBeenCalledWith(
        '/self-serve/reschedule/test-token-123',
        { startTime: '2026-03-20T09:00:00Z', staffId: 'st1' },
      );
    });
  });

  test('shows submitting state while rescheduling', async () => {
    mockPublicApi.get
      .mockResolvedValueOnce(mockBookingData)
      .mockResolvedValueOnce(mockSlots);
    mockPublicApi.post.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ReschedulePage />);
    await waitFor(() => screen.getByText('Select a new date'));

    fireEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() => screen.getByText('9:00 AM'));

    fireEvent.click(screen.getByText('9:00 AM'));
    fireEvent.click(screen.getByText('Confirm New Time'));

    await waitFor(() => {
      expect(screen.getByText('Rescheduling...')).toBeInTheDocument();
    });
  });

  // ─── Success state ─────────────────────────────────────────────────

  test('shows success state after rescheduling', async () => {
    mockPublicApi.get
      .mockResolvedValueOnce(mockBookingData)
      .mockResolvedValueOnce(mockSlots);
    mockPublicApi.post.mockResolvedValue({});
    render(<ReschedulePage />);
    await waitFor(() => screen.getByText('Select a new date'));

    fireEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() => screen.getByText('9:00 AM'));

    fireEvent.click(screen.getByText('9:00 AM'));
    fireEvent.click(screen.getByText('Confirm New Time'));

    await waitFor(() => {
      expect(screen.getByText('Appointment Rescheduled')).toBeInTheDocument();
      expect(screen.getByText(/Hydra Facial/)).toBeInTheDocument();
    });
  });

  // ─── Error state ───────────────────────────────────────────────────

  test('shows error when token is invalid', async () => {
    mockPublicApi.get.mockRejectedValue(new Error('Token has expired'));
    render(<ReschedulePage />);
    await waitFor(() => {
      expect(screen.getByText('Unable to Reschedule')).toBeInTheDocument();
      expect(screen.getByText('Token has expired')).toBeInTheDocument();
    });
  });

  test('shows error when reschedule fails', async () => {
    mockPublicApi.get
      .mockResolvedValueOnce(mockBookingData)
      .mockResolvedValueOnce(mockSlots);
    mockPublicApi.post.mockRejectedValue(new Error('Slot no longer available'));
    render(<ReschedulePage />);
    await waitFor(() => screen.getByText('Select a new date'));

    fireEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() => screen.getByText('9:00 AM'));

    fireEvent.click(screen.getByText('9:00 AM'));
    fireEvent.click(screen.getByText('Confirm New Time'));

    await waitFor(() => {
      expect(screen.getByText('Unable to Reschedule')).toBeInTheDocument();
      expect(screen.getByText('Slot no longer available')).toBeInTheDocument();
    });
  });

  // ─── No slots ──────────────────────────────────────────────────────

  test('shows "no times" message when no slots available', async () => {
    mockPublicApi.get
      .mockResolvedValueOnce(mockBookingData)
      .mockResolvedValueOnce([]); // empty slots
    render(<ReschedulePage />);
    await waitFor(() => screen.getByText('Select a new date'));

    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => {
      expect(
        screen.getByText('No times available on this day. Try another date.'),
      ).toBeInTheDocument();
    });
  });

  // ─── Policy text ───────────────────────────────────────────────────

  test('displays policy text when present', async () => {
    mockPublicApi.get.mockResolvedValue(mockBookingData);
    render(<ReschedulePage />);
    await waitFor(() => {
      expect(
        screen.getByText('Rescheduling within 24 hours may not be possible.'),
      ).toBeInTheDocument();
    });
  });
});

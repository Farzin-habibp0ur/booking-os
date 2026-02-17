import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ClaimWaitlistPage from './page';

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

const mockClaimData = {
  entry: {
    id: 'wl1',
    status: 'OFFERED',
    offeredSlot: {
      startTime: '2026-03-20T14:00:00Z',
      serviceName: 'Hydra Facial',
      staffName: 'Jane D.',
    },
    offerExpiresAt: '2026-03-19T18:00:00Z',
    service: { id: 's1', name: 'Hydra Facial', durationMins: 60, price: 150 },
    staff: { id: 'st1', name: 'Jane D.' },
    customer: { name: 'Alice Smith' },
  },
  business: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic' },
};

describe('ClaimWaitlistPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Loading ────────────────────────────────────────────────────────

  test('shows loading state initially', () => {
    mockPublicApi.get.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ClaimWaitlistPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // ─── Offer details ─────────────────────────────────────────────────

  test('renders offer details with service, date, time', async () => {
    mockPublicApi.get.mockResolvedValue(mockClaimData);
    render(<ClaimWaitlistPage />);
    await waitFor(() => {
      expect(screen.getByText('Glow Clinic')).toBeInTheDocument();
      expect(screen.getByText('Hydra Facial')).toBeInTheDocument();
      expect(screen.getByText('A slot has opened for you!')).toBeInTheDocument();
    });
  });

  test('shows staff name in offer details', async () => {
    mockPublicApi.get.mockResolvedValue(mockClaimData);
    render(<ClaimWaitlistPage />);
    await waitFor(() => {
      expect(screen.getByText('Jane D.')).toBeInTheDocument();
    });
  });

  test('shows expiry notice', async () => {
    mockPublicApi.get.mockResolvedValue(mockClaimData);
    render(<ClaimWaitlistPage />);
    await waitFor(() => {
      expect(screen.getByText(/This offer expires/)).toBeInTheDocument();
    });
  });

  // ─── Confirm flow ──────────────────────────────────────────────────

  test('confirm button calls the claim API', async () => {
    mockPublicApi.get.mockResolvedValue(mockClaimData);
    mockPublicApi.post.mockResolvedValue({});
    render(<ClaimWaitlistPage />);
    await waitFor(() => screen.getByText('Confirm Booking'));

    fireEvent.click(screen.getByText('Confirm Booking'));

    await waitFor(() => {
      expect(mockPublicApi.post).toHaveBeenCalledWith(
        '/self-serve/claim-waitlist/test-token-123',
        {},
      );
    });
  });

  test('shows claiming state while confirming', async () => {
    mockPublicApi.get.mockResolvedValue(mockClaimData);
    mockPublicApi.post.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ClaimWaitlistPage />);
    await waitFor(() => screen.getByText('Confirm Booking'));

    fireEvent.click(screen.getByText('Confirm Booking'));

    await waitFor(() => {
      expect(screen.getByText('Claiming...')).toBeInTheDocument();
    });
  });

  // ─── Success state ─────────────────────────────────────────────────

  test('shows success state with booking details', async () => {
    mockPublicApi.get.mockResolvedValue(mockClaimData);
    mockPublicApi.post.mockResolvedValue({});
    render(<ClaimWaitlistPage />);
    await waitFor(() => screen.getByText('Confirm Booking'));

    fireEvent.click(screen.getByText('Confirm Booking'));

    await waitFor(() => {
      expect(screen.getByText('Booking Confirmed!')).toBeInTheDocument();
      expect(
        screen.getByText('Your slot has been claimed and your booking is confirmed.'),
      ).toBeInTheDocument();
    });
  });

  // ─── Error state ───────────────────────────────────────────────────

  test('shows error when token is invalid', async () => {
    mockPublicApi.get.mockRejectedValue(new Error('Offer has expired'));
    render(<ClaimWaitlistPage />);
    await waitFor(() => {
      expect(screen.getByText('Unable to Claim')).toBeInTheDocument();
      expect(screen.getByText('Offer has expired')).toBeInTheDocument();
    });
  });

  // ─── No staff ──────────────────────────────────────────────────────

  test('renders without staff row when staffName is null', async () => {
    const noStaffData = {
      ...mockClaimData,
      entry: {
        ...mockClaimData.entry,
        offeredSlot: { ...mockClaimData.entry.offeredSlot, staffName: null },
        staff: null,
      },
    };
    mockPublicApi.get.mockResolvedValue(noStaffData);
    render(<ClaimWaitlistPage />);
    await waitFor(() => {
      expect(screen.getByText('Hydra Facial')).toBeInTheDocument();
    });
    // "Staff" label should not appear when staffName is null
    expect(screen.queryByText('Staff')).not.toBeInTheDocument();
  });
});

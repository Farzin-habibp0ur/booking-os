import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecommendedSlots from './recommended-slots';

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: '1', businessId: 'b1' }, token: 'tok' }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { get: (...args: any[]) => mockGet(...args) },
}));

const mockSlots = [
  { time: '2026-03-01T11:00:00Z', display: '11:00', staffId: 's1', staffName: 'Sarah Johnson' },
  { time: '2026-03-01T12:00:00Z', display: '12:00', staffId: 's2', staffName: 'Lisa Chen' },
];

describe('RecommendedSlots', () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue(mockSlots);
  });

  it('renders recommended slot buttons', async () => {
    await act(async () => {
      render(<RecommendedSlots serviceId="svc1" date="2026-03-01" onSelect={onSelect} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Recommended times')).toBeInTheDocument();
      expect(screen.getByText('11:00 · Sarah')).toBeInTheDocument();
      expect(screen.getByText('12:00 · Lisa')).toBeInTheDocument();
    });
  });

  it('calls onSelect when slot is clicked', async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<RecommendedSlots serviceId="svc1" date="2026-03-01" onSelect={onSelect} />);
    });

    await waitFor(() => {
      expect(screen.getByText('11:00 · Sarah')).toBeInTheDocument();
    });

    await user.click(screen.getByText('11:00 · Sarah'));
    expect(onSelect).toHaveBeenCalledWith(mockSlots[0]);
  });

  it('renders nothing when no slots returned', async () => {
    mockGet.mockResolvedValue([]);

    const { container } = await act(async () => {
      return render(<RecommendedSlots serviceId="svc1" date="2026-03-01" onSelect={onSelect} />);
    });

    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('passes excludeBookingId to API', async () => {
    await act(async () => {
      render(
        <RecommendedSlots
          serviceId="svc1"
          date="2026-03-01"
          excludeBookingId="b-exclude"
          onSelect={onSelect}
        />,
      );
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('excludeBookingId=b-exclude'));
    });
  });
});

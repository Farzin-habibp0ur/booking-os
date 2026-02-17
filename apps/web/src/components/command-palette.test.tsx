import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import CommandPalette from './command-palette';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));

const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
  },
}));

const mockSearchResults = {
  customers: [
    { id: 'c1', name: 'Alice Smith', phone: '+1234567890', email: 'alice@test.com' },
  ],
  bookings: [
    {
      id: 'b1',
      startTime: '2026-03-15T10:00:00Z',
      status: 'CONFIRMED',
      customer: { name: 'Alice Smith' },
      service: { name: 'Hydra Facial' },
    },
  ],
  services: [
    { id: 's1', name: 'Hydra Facial', durationMins: 60, price: 150 },
  ],
  conversations: [],
};

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
};

describe('CommandPalette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Visibility ────────────────────────────────────────────────────

  test('renders nothing when not open', () => {
    const { container } = render(
      <CommandPalette isOpen={false} onClose={jest.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  test('renders search input when open', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(
      screen.getByPlaceholderText('Search customers, bookings, services...'),
    ).toBeInTheDocument();
  });

  // ─── Search debounce ──────────────────────────────────────────────

  test('typing triggers search after debounce', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search customers, bookings, services...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    // Before debounce: should NOT have called API
    expect(mockGet).not.toHaveBeenCalled();

    // After debounce (200ms)
    act(() => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/search?q=Alice');
    });
  });

  // ─── Results display ──────────────────────────────────────────────

  test('displays results by type', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search customers, bookings, services...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.getByText('Bookings')).toBeInTheDocument();
      expect(screen.getByText('Services')).toBeInTheDocument();
    });
  });

  // ─── Keyboard navigation ──────────────────────────────────────────

  test('escape key calls onClose', () => {
    const onClose = jest.fn();
    render(<CommandPalette isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText('Search customers, bookings, services...');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  test('enter key navigates to selected result', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search customers, bookings, services...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockPush).toHaveBeenCalledWith('/customers');
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // ─── Click result ─────────────────────────────────────────────────

  test('clicking a result navigates and closes', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search customers, bookings, services...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Alice Smith'));

    expect(mockPush).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // ─── No results ───────────────────────────────────────────────────

  test('shows "no results" for empty search results', async () => {
    mockGet.mockResolvedValue({
      customers: [],
      bookings: [],
      services: [],
      conversations: [],
    });
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search customers, bookings, services...');
    fireEvent.change(input, { target: { value: 'zzzzz' } });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(screen.getByText(/No results for/)).toBeInTheDocument();
    });
  });

  // ─── Recent items ─────────────────────────────────────────────────

  test('shows recent items when query is empty', () => {
    // Seed localStorage with recent items
    const recent = [
      { type: 'customer', id: 'customer-c1', label: 'Recent Customer', sublabel: '+1234567890', href: '/customers' },
    ];
    localStorage.setItem('cmd-k-recent', JSON.stringify(recent));

    render(<CommandPalette {...defaultProps} />);

    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('Recent Customer')).toBeInTheDocument();
  });

  // ─── Clear query ──────────────────────────────────────────────────

  test('clears query when X button is clicked', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search customers, bookings, services...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    // The X button should be visible when there is a query
    act(() => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    // Find the X (clear) button - it's a sibling of the input
    const clearButton = input.parentElement!.querySelector('button')!;
    fireEvent.click(clearButton);

    expect(input).toHaveValue('');
  });
});

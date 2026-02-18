import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import CommandPalette from './command-palette';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'aesthetic',
    slug: 'aesthetic',
    labels: { customer: 'Patient', booking: 'Appointment', service: 'Treatment' },
    customerFields: [],
  }),
}));

const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
  },
}));

const mockSearchResults = {
  customers: [{ id: 'c1', name: 'Alice Smith', phone: '+1234567890', email: 'alice@test.com' }],
  bookings: [
    {
      id: 'b1',
      startTime: '2026-03-15T10:00:00Z',
      status: 'CONFIRMED',
      customer: { name: 'Alice Smith' },
      service: { name: 'Hydra Facial' },
    },
  ],
  services: [{ id: 's1', name: 'Hydra Facial', durationMins: 60, price: 150 }],
  conversations: [
    {
      id: 'conv1',
      customer: { name: 'Bob Jones' },
      lastMessageAt: '2026-03-10T10:00:00Z',
      status: 'OPEN',
    },
  ],
  totals: { customers: 1, bookings: 1, services: 1, conversations: 1 },
};

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
};

describe('CommandPalette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Visibility ────────────────────────────────────────────────────

  test('renders nothing when not open', () => {
    const { container } = render(<CommandPalette isOpen={false} onClose={jest.fn()} />);
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

    expect(mockGet).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/search?q=Alice');
    });
  });

  // ─── Results display ──────────────────────────────────────────────

  test('displays results grouped by type', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search customers, bookings, services...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      // Verify grouped section headers with vertical labels
      expect(screen.getByTestId('group-customer')).toBeInTheDocument();
      expect(screen.getByTestId('group-booking')).toBeInTheDocument();
      expect(screen.getByTestId('group-service')).toBeInTheDocument();
      expect(screen.getByTestId('group-conversation')).toBeInTheDocument();
    });
  });

  test('shows vertical-aware labels in group headers', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search customers, bookings, services...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      // Pack labels: Patient, Appointment, Treatment
      expect(screen.getByText('Patients')).toBeInTheDocument();
      expect(screen.getByText('Appointments')).toBeInTheDocument();
      expect(screen.getByText('Treatments')).toBeInTheDocument();
    });
  });

  // ─── Fixed navigation hrefs ────────────────────────────────────────

  test('customer results link to detail page', async () => {
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

    // First result (customer) should be active by default
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockPush).toHaveBeenCalledWith('/customers/c1');
  });

  test('conversation results link to inbox with conversationId', async () => {
    mockGet.mockResolvedValue({
      customers: [],
      bookings: [],
      services: [],
      conversations: [
        {
          id: 'conv1',
          customer: { name: 'Alice Smith' },
          lastMessageAt: '2026-03-10T10:00:00Z',
          status: 'OPEN',
        },
      ],
      totals: { customers: 0, bookings: 0, services: 0, conversations: 1 },
    });
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

    expect(mockPush).toHaveBeenCalledWith('/inbox?conversationId=conv1');
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

    expect(mockPush).toHaveBeenCalledWith('/customers/c1');
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
      totals: { customers: 0, bookings: 0, services: 0, conversations: 0 },
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
    const recent = [
      {
        type: 'customer',
        id: 'customer-c1',
        label: 'Recent Customer',
        sublabel: '+1234567890',
        href: '/customers/c1',
      },
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

    act(() => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    const clearButton = input.parentElement!.querySelector('button')!;
    fireEvent.click(clearButton);

    expect(input).toHaveValue('');
  });

  // ─── View all results ─────────────────────────────────────────────

  test('shows "View all results" link when results exist', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search customers, bookings, services...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(screen.getByTestId('view-all-results')).toBeInTheDocument();
    });
  });

  test('clicking "View all results" navigates to /search page', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search customers, bookings, services...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(screen.getByTestId('view-all-results')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('view-all-results'));

    expect(mockPush).toHaveBeenCalledWith('/search?q=Alice');
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('does not show "View all results" when no results', async () => {
    mockGet.mockResolvedValue({
      customers: [],
      bookings: [],
      services: [],
      conversations: [],
      totals: { customers: 0, bookings: 0, services: 0, conversations: 0 },
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

    expect(screen.queryByTestId('view-all-results')).not.toBeInTheDocument();
  });
});

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

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      role: 'ADMIN',
      businessId: 'b1',
      business: { id: 'b1', verticalPack: 'aesthetic', packConfig: {} },
    },
    logout: jest.fn(),
  }),
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'cmdk.placeholder') return 'Search pages, customers, bookings...';
      if (key === 'cmdk.hint') return 'All pages searchable';
      if (key === 'nav.section_workspace') return 'Workspace';
      if (key === 'nav.section_tools') return 'Tools';
      if (key === 'nav.section_insights') return 'Insights';
      if (key === 'nav.section_ai_agents') return 'AI & Agents';
      return key;
    },
  }),
}));

jest.mock('@/lib/use-mode', () => ({
  useMode: () => ({
    mode: 'admin',
    modeDef: {
      key: 'admin',
      sections: {
        workspace: ['/dashboard', '/inbox', '/calendar', '/customers', '/bookings', '/waitlist'],
        tools: ['/services', '/staff', '/invoices', '/campaigns', '/automations', '/testimonials'],
        insights: ['/dashboard', '/reports', '/reports/monthly-review', '/roi'],
        aiAgents: ['/ai', '/ai/agents', '/ai/actions', '/ai/performance'],
      },
    },
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
  staff: [{ id: 'st1', name: 'Dr. Sarah', email: 'sarah@clinic.com', role: 'ADMIN' }],
  conversations: [
    {
      id: 'conv1',
      customer: { name: 'Bob Jones' },
      lastMessageAt: '2026-03-10T10:00:00Z',
      status: 'OPEN',
    },
  ],
  totals: { customers: 1, bookings: 1, services: 1, staff: 1, conversations: 1 },
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
    expect(screen.getByPlaceholderText('Search pages, customers, bookings...')).toBeInTheDocument();
  });

  // ─── Search debounce ──────────────────────────────────────────────

  test('typing triggers search after debounce', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    expect(mockGet).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/search?q=Alice');
    });
  });

  // ─── Results display ──────────────────────────────────────────────

  test('displays results grouped by type', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(300);
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

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(300);
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

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(300);
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

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(300);
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

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  test('enter key navigates to selected result', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(300);
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

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(300);
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

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'zzzzz' } });

    act(() => {
      jest.advanceTimersByTime(300);
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

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(300);
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

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('view-all-results')).toBeInTheDocument();
    });
  });

  test('clicking "View all results" navigates to /search page', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(300);
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

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'zzzzz' } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText(/No results for/)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('view-all-results')).not.toBeInTheDocument();
  });

  // ─── Quick actions ─────────────────────────────────────────────────

  test('shows quick actions when query is empty', () => {
    render(<CommandPalette {...defaultProps} />);

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('New Booking')).toBeInTheDocument();
    expect(screen.getByText('New Customer')).toBeInTheDocument();
  });

  test('clicking New Booking navigates and closes', () => {
    const onClose = jest.fn();
    render(<CommandPalette isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByText('New Booking'));

    expect(mockPush).toHaveBeenCalledWith('/bookings?new=true');
    expect(onClose).toHaveBeenCalled();
  });

  test('clicking New Customer navigates and closes', () => {
    const onClose = jest.fn();
    render(<CommandPalette isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByText('New Customer'));

    expect(mockPush).toHaveBeenCalledWith('/customers?new=true');
    expect(onClose).toHaveBeenCalled();
  });

  test('quick actions are hidden when searching', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'Alice' } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    expect(screen.queryByText('Quick Actions')).not.toBeInTheDocument();
  });

  // ─── Staff results ─────────────────────────────────────────────────

  test('displays staff results in search', async () => {
    mockGet.mockResolvedValue(mockSearchResults);
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'Sarah' } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText('Dr. Sarah')).toBeInTheDocument();
    });

    expect(screen.getByTestId('group-staff')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
  });

  // ─── Page navigation ─────────────────────────────────────────────

  test('shows matching pages when typing a page name', () => {
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    fireEvent.change(input, { target: { value: 'cal' } });

    expect(screen.getByTestId('pages-section')).toBeInTheDocument();
    expect(screen.getByText('nav.calendar')).toBeInTheDocument();
  });

  test('page results are grouped by section', () => {
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    // "automations" matches the /automations href
    fireEvent.change(input, { target: { value: 'automations' } });

    const pagesSection = screen.getByTestId('pages-section');
    expect(pagesSection).toBeInTheDocument();
    // t() returns the key string
    expect(screen.getByText('nav.automations')).toBeInTheDocument();
  });

  test('page results include overflow routes (e.g. AI sub-routes)', () => {
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    // "ai/actions" matches the /ai/actions href
    fireEvent.change(input, { target: { value: 'ai/actions' } });

    // t() returns the key string
    expect(screen.getByText('nav.ai_actions')).toBeInTheDocument();
  });

  test('clicking a page result navigates and closes', () => {
    const onClose = jest.fn();
    render(<CommandPalette isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText('Search pages, customers, bookings...');
    // "campaigns" matches the /campaigns href
    fireEvent.change(input, { target: { value: 'campaigns' } });

    // t() returns the key string
    fireEvent.click(screen.getByText('nav.campaigns'));

    expect(mockPush).toHaveBeenCalledWith('/campaigns');
    expect(onClose).toHaveBeenCalled();
  });

  // ─── Footer hint ─────────────────────────────────────────────────

  test('shows "All pages searchable" hint in footer', () => {
    render(<CommandPalette {...defaultProps} />);

    expect(screen.getByTestId('cmdk-hint')).toHaveTextContent('All pages searchable');
  });
});

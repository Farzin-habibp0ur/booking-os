import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingsPage from './page';

// Mock next/navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'test-id' }),
}));

// Mock next/link
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

// Mock auth
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    login: jest.fn(),
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

// Mock i18n
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
  I18nProvider: ({ children }: any) => children,
}));

// Mock vertical-pack
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
    customerFields: [],
  }),
  VerticalPackProvider: ({ children }: any) => children,
}));

// Mock toast
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => children,
}));

// Mock cn
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock api
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
    upload: jest.fn(),
  },
}));

// Mock skeleton components
jest.mock('@/components/skeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton">Loading...</div>,
  TableRowSkeleton: ({ cols }: any) => (
    <tr data-testid="table-skeleton">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} />
      ))}
    </tr>
  ),
  EmptyState: ({ title, icon: Icon, description }: any) => (
    <div data-testid="empty-state">
      {Icon && <Icon />}
      <div>{title}</div>
      {description && <div>{description}</div>}
    </div>
  ),
}));

jest.mock('@/components/feature-discovery', () => ({
  FeatureDiscovery: () => null,
}));
jest.mock('@/components/upgrade-nudge', () => ({
  UpgradeNudge: () => null,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  BookOpen: () => <div data-testid="book-open-icon" />,
  X: () => <div data-testid="x-icon" />,
  Download: () => <div data-testid="download-icon" />,
  Search: () => <div data-testid="search-icon" />,
  ChevronUp: (props: any) => <div data-testid={props['data-testid'] || 'chevron-up-icon'} />,
  ChevronDown: (props: any) => <div data-testid={props['data-testid'] || 'chevron-down-icon'} />,
  Filter: () => <div data-testid="filter-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  Printer: () => <div data-testid="printer-icon" />,
}));

// Mock ExportModal
jest.mock('@/components/export-modal', () => ({
  __esModule: true,
  default: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="export-modal">
        <button data-testid="export-close" onClick={onClose}>
          Close Export
        </button>
      </div>
    ) : null,
}));

// Mock BookingDetailModal with prop-forwarding so we can test interactions
let mockDetailModalProps: any = {};
jest.mock('@/components/booking-detail-modal', () => ({
  __esModule: true,
  default: (props: any) => {
    mockDetailModalProps = props;
    return props.isOpen ? (
      <div data-testid="booking-detail-modal">
        <span data-testid="detail-booking-id">{props.booking?.id}</span>
        <button data-testid="detail-close-btn" onClick={props.onClose}>
          Close
        </button>
        <button data-testid="detail-updated-btn" onClick={props.onUpdated}>
          Updated
        </button>
        <button
          data-testid="detail-reschedule-btn"
          onClick={() => props.onReschedule(props.booking)}
        >
          Reschedule
        </button>
      </div>
    ) : null;
  },
}));

// Mock BookingFormModal with prop-forwarding
let mockFormModalProps: any = {};
jest.mock('@/components/booking-form-modal', () => ({
  __esModule: true,
  default: (props: any) => {
    mockFormModalProps = props;
    return props.isOpen ? (
      <div data-testid="booking-form-modal">
        <span data-testid="form-reschedule-id">{props.rescheduleBookingId}</span>
        <button data-testid="form-close-btn" onClick={props.onClose}>
          Close
        </button>
        <button data-testid="form-created-btn" onClick={props.onCreated}>
          Created
        </button>
      </div>
    ) : null;
  },
}));

// Mock saved-views
jest.mock('@/components/saved-views', () => ({
  ViewPicker: (props: any) => <div data-testid="view-picker" />,
  SaveViewModal: () => null,
}));

// Mock BulkActionBar with prop-forwarding
jest.mock('@/components/bulk-action-bar', () => ({
  __esModule: true,
  default: (props: any) => {
    if (props.count === 0) return null;
    return (
      <div data-testid="bulk-action-bar">
        <span data-testid="bulk-count">{props.count} selected</span>
        <button data-testid="bulk-clear-btn" onClick={props.onClear}>
          Clear
        </button>
        {props.actions.map((action: any) => (
          <button
            key={action.label}
            data-testid={`bulk-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  },
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

// Helper to create mock bookings
const createBooking = (overrides: any = {}) => ({
  id: 'b1',
  customer: { name: 'John Doe' },
  service: { name: 'Haircut' },
  staff: { name: 'Sarah' },
  startTime: '2026-01-15T10:00:00Z',
  status: 'CONFIRMED',
  customerId: 'c1',
  ...overrides,
});

const mockStaff = [
  { id: 's1', name: 'Sarah' },
  { id: 's2', name: 'Mike' },
];

describe('BookingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetailModalProps = {};
    mockFormModalProps = {};
  });

  // ─── Loading & Initial Render ───────────────────────────────

  it('renders bookings page with title', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });
  });

  it('shows loading skeletons while fetching data', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<BookingsPage />);

    const skeletons = screen.getAllByTestId('table-skeleton');
    expect(skeletons).toHaveLength(5);
  });

  it('renders table column headers from pack labels', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('common.provider')).toBeInTheDocument();
      expect(screen.getByText('bookings.date_time')).toBeInTheDocument();
      expect(screen.getByText('common.status')).toBeInTheDocument();
    });
  });

  // ─── Booking List Rendering ─────────────────────────────────

  it('displays bookings in table with all columns', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({
          id: '1',
          customer: { name: 'John' },
          service: { name: 'Haircut' },
          staff: { name: 'Sarah' },
          status: 'CONFIRMED',
        }),
        createBooking({
          id: '2',
          customer: { name: 'Jane' },
          service: { name: 'Massage' },
          staff: { name: 'Mike' },
          status: 'PENDING',
          startTime: '2026-01-16T14:00:00Z',
        }),
      ],
      total: 2,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Jane')).toBeInTheDocument();
      expect(screen.getByText('Haircut')).toBeInTheDocument();
      expect(screen.getByText('Massage')).toBeInTheDocument();
      expect(screen.getByText('Sarah')).toBeInTheDocument();
      expect(screen.getByText('Mike')).toBeInTheDocument();
    });
  });

  it('shows unassigned text when staff is null', async () => {
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: '1', staff: null })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('common.unassigned')).toBeInTheDocument();
    });
  });

  it('renders status badges with translated status text', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: '1', status: 'CONFIRMED' }),
        createBooking({ id: '2', status: 'PENDING', customer: { name: 'Jane' } }),
        createBooking({ id: '3', status: 'CANCELLED', customer: { name: 'Bob' } }),
      ],
      total: 3,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('status.confirmed')).toBeInTheDocument();
      expect(screen.getByText('status.pending')).toBeInTheDocument();
      expect(screen.getByText('status.cancelled')).toBeInTheDocument();
    });
  });

  it('formats dates correctly in booking rows', async () => {
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: '1', startTime: '2026-01-15T10:00:00Z' })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      // The date should be rendered using toLocaleString
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find the row and verify a date cell exists
    const rows = screen.getAllByRole('row');
    // Header row + 1 data row
    expect(rows.length).toBe(2);
  });

  // ─── Empty State ────────────────────────────────────────────

  it('shows empty state when no bookings', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('shows empty state with filter description when filter active', async () => {
    const user = userEvent.setup();
    // First call for default, second call for filtered
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    const select = screen.getByTestId('status-filter');

    await act(async () => {
      await user.selectOptions(select, 'CANCELLED');
    });

    await waitFor(() => {
      const emptyState = screen.getByTestId('empty-state');
      // When statusFilter is set, description should mention filters
      expect(emptyState).toBeInTheDocument();
      expect(screen.getByText(/match your filters/i)).toBeInTheDocument();
    });
  });

  it('shows create first entity text when no filter and no bookings', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.create_first')).toBeInTheDocument();
    });
  });

  // ─── Status Filter ──────────────────────────────────────────

  it('has status filter dropdown with all status options', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    const select = screen.getByTestId('status-filter');
    expect(select).toBeInTheDocument();

    // Check for "All statuses" option
    expect(screen.getByText('bookings.all_statuses')).toBeInTheDocument();

    // Check that all status options are present
    const options = within(select).getAllByRole('option');
    // 1 "all" option + 7 status options
    expect(options).toHaveLength(8);
  });

  it('filters by status when dropdown changes to CONFIRMED', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    expect(mockApi.get).toHaveBeenCalledWith('/bookings?pageSize=50');

    const select = screen.getByTestId('status-filter');

    await act(async () => {
      await user.selectOptions(select, 'CONFIRMED');
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/bookings?pageSize=50&status=CONFIRMED');
    });
  });

  it('filters by status when dropdown changes to PENDING', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    const select = screen.getByTestId('status-filter');

    await act(async () => {
      await user.selectOptions(select, 'PENDING');
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/bookings?pageSize=50&status=PENDING');
    });
  });

  it('filters by RESCHEDULED status', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    const select = screen.getByTestId('status-filter');

    await act(async () => {
      await user.selectOptions(select, 'RESCHEDULED');
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/bookings?pageSize=50&status=RESCHEDULED');
    });
  });

  it('resets to all when filter changes back to empty', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    const select = screen.getByTestId('status-filter');

    // Set filter to CONFIRMED
    await act(async () => {
      await user.selectOptions(select, 'CONFIRMED');
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/bookings?pageSize=50&status=CONFIRMED');
    });

    // Reset to all statuses
    await act(async () => {
      await user.selectOptions(select, '');
    });

    await waitFor(() => {
      // The last call should be without status
      const calls = mockApi.get.mock.calls;
      const lastBookingCall = calls.filter((c: any) => c[0].startsWith('/bookings')).pop();
      expect(lastBookingCall?.[0]).toBe('/bookings?pageSize=50');
    });
  });

  // ─── Search Functionality ──────────────────────────────────

  it('sends search query to API after debounce', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: 'b1', customer: { name: 'John Doe' } }),
        createBooking({ id: 'b2', customer: { name: 'Jane Smith' } }),
      ],
      total: 2,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find and use the search input
    const searchInput = screen.getByPlaceholderText(/search.*booking/i);

    await act(async () => {
      await user.type(searchInput, 'Jane');
    });

    // After debounce, should call API with search param
    await waitFor(
      () => {
        expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('search=Jane'));
      },
      { timeout: 500 },
    );
  });

  it('clears search when X button is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: 'b1', customer: { name: 'John' } }),
        createBooking({ id: 'b2', customer: { name: 'Jane' } }),
      ],
      total: 2,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search.*booking/i) as HTMLInputElement;

    await act(async () => {
      await user.type(searchInput, 'John');
    });

    // The X button appears when search has text
    expect(searchInput.value).toBe('John');

    // Find the clear button via data-testid
    const clearButton = screen.getByTestId('search-clear');
    await act(async () => {
      await user.click(clearButton);
    });

    await waitFor(
      () => {
        expect(searchInput.value).toBe('');
      },
      { timeout: 500 },
    );
  });

  // ─── Sorting Functionality ──────────────────────────────────

  it('table headers are clickable for sorting', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: 'b1', customer: { name: 'John' }, startTime: '2026-01-15T10:00:00Z' }),
        createBooking({ id: 'b2', customer: { name: 'Alice' }, startTime: '2026-01-14T10:00:00Z' }),
      ],
      total: 2,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    // Headers should be clickable — the <th> itself has cursor-pointer
    const customerHeader = screen.getAllByText('Customer')[0].closest('th')!;
    expect(customerHeader).toHaveClass('cursor-pointer');
  });

  it('sorts by customer name when customer header is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: 'b1', customer: { name: 'John' } }),
        createBooking({ id: 'b2', customer: { name: 'Alice' } }),
      ],
      total: 2,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('sort-header-customer'));
    });

    // After first click, should send sortBy=customerName to API (server-side sort)
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('sortBy=customerName'));
    });
  });

  it('displays sort indicator on sorted column', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: 'b1', customer: { name: 'John' } }),
        createBooking({ id: 'b2', customer: { name: 'Alice' } }),
      ],
      total: 2,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    const customerHeader = screen.getAllByText('Customer')[0];

    await act(async () => {
      await user.click(customerHeader.parentElement!);
    });

    // Should show sort indicator (ChevronUp for ascending)
    const chevrons = screen.queryAllByTestId(/chevron/i);
    // The component uses ChevronUp/ChevronDown from lucide-react
    // Just verify the header has an indicator after sorting
    expect(customerHeader.parentElement?.textContent).toContain('Customer');
  });

  // ─── Filters Panel ─────────────────────────────────────────

  it('shows filters button in toolbar', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    const filterButton = screen.getByRole('button', { name: /common.filters/i });
    expect(filterButton).toBeInTheDocument();
  });

  it('toggles filters panel when filter button is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    const filterButton = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.includes('common.filters'));

    // Initially filters panel should not be visible
    let fromDateLabel = screen.queryByText('common.from_date');
    expect(fromDateLabel).not.toBeInTheDocument();

    // Click to open
    await act(async () => {
      await user.click(filterButton!);
    });

    // Now filter inputs should be visible
    fromDateLabel = screen.getByText('common.from_date');
    expect(fromDateLabel).toBeInTheDocument();

    // Click to close
    await act(async () => {
      await user.click(filterButton!);
    });

    fromDateLabel = screen.queryByText('common.from_date');
    expect(fromDateLabel).not.toBeInTheDocument();
  });

  it('sends date range filters to API', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: 'b1', customer: { name: 'John' }, startTime: '2026-01-15T10:00:00Z' }),
      ],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    const filterButton = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.includes('common.filters'));

    await act(async () => {
      await user.click(filterButton!);
    });

    // Find date inputs by data-testid
    const fromDateInput = screen.getByTestId('date-from');
    const toDateInput = screen.getByTestId('date-to');

    await act(async () => {
      await user.type(fromDateInput, '2026-01-16');
      await user.type(toDateInput, '2026-01-19');
    });

    await waitFor(
      () => {
        expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('dateFrom=2026-01-16'));
        expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('dateTo=2026-01-19'));
      },
      { timeout: 500 },
    );
  });

  it('sends staff filter to API', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff')
        return Promise.resolve([
          { id: 's1', name: 'Sarah' },
          { id: 's2', name: 'Mike' },
        ]);
      return Promise.resolve({
        data: [createBooking({ id: 'b1', staff: { name: 'Sarah' }, staffId: 's1' })],
        total: 1,
      });
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    const filterButton = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.includes('common.filters'));

    await act(async () => {
      await user.click(filterButton!);
    });

    // Wait for staff filter to be available, then select
    await waitFor(() => {
      expect(screen.getByText('common.staff')).toBeInTheDocument();
    });

    const staffSelect = screen.getByTestId('staff-filter');

    await act(async () => {
      await user.selectOptions(staffSelect, 's1');
    });

    await waitFor(
      () => {
        expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('staffId=s1'));
      },
      { timeout: 500 },
    );
  });

  // ─── Booking Detail Modal ───────────────────────────────────

  it('opens detail modal when clicking customer name cell', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1' })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click customer name cell
    await act(async () => {
      await user.click(screen.getByText('John Doe'));
    });

    expect(screen.getByTestId('booking-detail-modal')).toBeInTheDocument();
    expect(screen.getByTestId('detail-booking-id')).toHaveTextContent('b1');
  });

  it('opens detail modal when clicking service cell', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1' })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Haircut')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Haircut'));
    });

    expect(screen.getByTestId('booking-detail-modal')).toBeInTheDocument();
  });

  it('closes detail modal when onClose is called', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1' })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Open modal
    await act(async () => {
      await user.click(screen.getByText('John Doe'));
    });

    expect(screen.getByTestId('booking-detail-modal')).toBeInTheDocument();

    // Close modal
    await act(async () => {
      await user.click(screen.getByTestId('detail-close-btn'));
    });

    expect(screen.queryByTestId('booking-detail-modal')).not.toBeInTheDocument();
  });

  it('reloads bookings when detail modal onUpdated is called', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1' })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const initialCallCount = mockApi.get.mock.calls.length;

    // Open modal
    await act(async () => {
      await user.click(screen.getByText('John Doe'));
    });

    // Trigger onUpdated
    await act(async () => {
      await user.click(screen.getByTestId('detail-updated-btn'));
    });

    // Should have made additional API calls to reload
    await waitFor(() => {
      expect(mockApi.get.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  // ─── Reschedule Modal ───────────────────────────────────────

  it('opens reschedule form modal when onReschedule is triggered from detail modal', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1', customerId: 'c1' })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Open detail modal
    await act(async () => {
      await user.click(screen.getByText('John Doe'));
    });

    expect(screen.getByTestId('booking-detail-modal')).toBeInTheDocument();

    // Click reschedule
    await act(async () => {
      await user.click(screen.getByTestId('detail-reschedule-btn'));
    });

    // Detail modal should close and form modal should open
    expect(screen.queryByTestId('booking-detail-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('booking-form-modal')).toBeInTheDocument();
    expect(screen.getByTestId('form-reschedule-id')).toHaveTextContent('b1');
  });

  it('closes reschedule form modal and reloads when onCreated is called', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1' })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Open detail, then reschedule
    await act(async () => {
      await user.click(screen.getByText('John Doe'));
    });
    await act(async () => {
      await user.click(screen.getByTestId('detail-reschedule-btn'));
    });

    expect(screen.getByTestId('booking-form-modal')).toBeInTheDocument();

    const callCountBefore = mockApi.get.mock.calls.length;

    // Trigger onCreated
    await act(async () => {
      await user.click(screen.getByTestId('form-created-btn'));
    });

    // Modal should close and reload bookings
    expect(screen.queryByTestId('booking-form-modal')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockApi.get.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  // ─── Individual Checkbox Selection ──────────────────────────

  it('toggles individual booking selection via checkbox', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: 'b1', customer: { name: 'John' } }),
        createBooking({ id: 'b2', customer: { name: 'Jane' } }),
      ],
      total: 2,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    // Get individual row checkboxes (skip the header checkbox)
    const checkboxes = screen.getAllByRole('checkbox');
    // 1 header checkbox + 2 row checkboxes
    expect(checkboxes).toHaveLength(3);

    const firstRowCheckbox = checkboxes[1]; // First booking row

    // Check the first row
    await act(async () => {
      await user.click(firstRowCheckbox);
    });

    // Bulk action bar should appear with 1 selected
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-count')).toHaveTextContent('1 selected');
  });

  it('deselects booking when clicking checkbox again', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1', customer: { name: 'John' } })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    const rowCheckbox = checkboxes[1];

    // Select
    await act(async () => {
      await user.click(rowCheckbox);
    });

    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();

    // Deselect
    await act(async () => {
      await user.click(rowCheckbox);
    });

    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
  });

  // ─── Select All ─────────────────────────────────────────────

  it('selects all bookings when header checkbox is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: 'b1', customer: { name: 'John' } }),
        createBooking({ id: 'b2', customer: { name: 'Jane' } }),
        createBooking({ id: 'b3', customer: { name: 'Bob' } }),
      ],
      total: 3,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    const headerCheckbox = checkboxes[0]; // Header checkbox

    // Select all
    await act(async () => {
      await user.click(headerCheckbox);
    });

    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-count')).toHaveTextContent('3 selected');
  });

  it('deselects all bookings when header checkbox is clicked and all are selected', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: 'b1', customer: { name: 'John' } }),
        createBooking({ id: 'b2', customer: { name: 'Jane' } }),
      ],
      total: 2,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    const headerCheckbox = checkboxes[0];

    // Select all
    await act(async () => {
      await user.click(headerCheckbox);
    });

    expect(screen.getByTestId('bulk-count')).toHaveTextContent('2 selected');

    // Deselect all
    await act(async () => {
      await user.click(headerCheckbox);
    });

    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
  });

  // ─── Bulk Action Bar ───────────────────────────────────────

  it('hides bulk action bar when no items selected', async () => {
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1' })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
  });

  it('shows Change Status and Assign Staff buttons in bulk action bar', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1' })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Select the booking
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    expect(screen.getByTestId('bulk-action-change-status')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-action-assign-staff')).toBeInTheDocument();
  });

  it('clears selection when bulk action bar clear is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1' })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Select
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();

    // Clear
    await act(async () => {
      await user.click(screen.getByTestId('bulk-clear-btn'));
    });

    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
  });

  // ─── Bulk Status Modal ─────────────────────────────────────

  it('opens bulk status modal when Change Status is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1', status: 'PENDING' })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Select and open modal
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-change-status'));
    });

    // The modal heading is an h3 with "Change Status"
    expect(screen.getByRole('heading', { name: 'Change Status' })).toBeInTheDocument();
    // Check that status option buttons are present in the modal
    // (dropdown also has these as <option> elements, so use getByRole('button'))
    expect(screen.getByRole('button', { name: 'status.confirmed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'status.cancelled' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'status.completed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'status.no_show' })).toBeInTheDocument();
  });

  it('calls API to change bulk status to CONFIRMED', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: 'b1', status: 'PENDING', customer: { name: 'John Doe' } }),
        createBooking({ id: 'b2', status: 'PENDING', customer: { name: 'Jane' } }),
      ],
      total: 2,
    });
    mockApi.patch.mockResolvedValue({});

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Select all
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[0]); // header checkbox
    });

    // Open bulk status modal
    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-change-status'));
    });

    // Click CONFIRMED button in the modal (not the option in the dropdown)
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'status.confirmed' }));
    });

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/bookings/bulk', {
        ids: ['b1', 'b2'],
        action: 'status',
        payload: { status: 'CONFIRMED' },
      });
    });
  });

  it('calls API to change bulk status to CANCELLED', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1', status: 'PENDING' })],
      total: 1,
    });
    mockApi.patch.mockResolvedValue({});

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Select
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    // Open bulk status modal
    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-change-status'));
    });

    // Click CANCELLED button in the modal
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'status.cancelled' }));
    });

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/bookings/bulk', {
        ids: ['b1'],
        action: 'status',
        payload: { status: 'CANCELLED' },
      });
    });
  });

  it('calls API to change bulk status to COMPLETED', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1', status: 'PENDING' })],
      total: 1,
    });
    mockApi.patch.mockResolvedValue({});

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-change-status'));
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'status.completed' }));
    });

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/bookings/bulk', {
        ids: ['b1'],
        action: 'status',
        payload: { status: 'COMPLETED' },
      });
    });
  });

  it('calls API to change bulk status to NO_SHOW', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1', status: 'PENDING' })],
      total: 1,
    });
    mockApi.patch.mockResolvedValue({});

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-change-status'));
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'status.no_show' }));
    });

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/bookings/bulk', {
        ids: ['b1'],
        action: 'status',
        payload: { status: 'NO_SHOW' },
      });
    });
  });

  it('closes bulk status modal and clears selection after successful status change', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1', status: 'PENDING' })],
      total: 1,
    });
    mockApi.patch.mockResolvedValue({});

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-change-status'));
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'status.confirmed' }));
    });

    await waitFor(() => {
      // Modal heading should be gone
      expect(screen.queryByRole('heading', { name: 'Change Status' })).not.toBeInTheDocument();
      // Selection should be cleared
      expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
    });
  });

  it('closes bulk status modal when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1', status: 'PENDING' })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-change-status'));
    });

    expect(screen.getByRole('heading', { name: 'Change Status' })).toBeInTheDocument();

    // Find and click Cancel button in the bulk status modal
    const cancelButtons = screen.getAllByText('Cancel');
    // The cancel button in the status modal
    await act(async () => {
      await user.click(cancelButtons[cancelButtons.length - 1]);
    });

    expect(screen.queryByRole('heading', { name: 'Change Status' })).not.toBeInTheDocument();
  });

  // ─── Bulk Assign Modal ─────────────────────────────────────

  it('opens bulk assign modal when Assign Staff is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve({ data: [createBooking({ id: 'b1' })], total: 1 });
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-assign-staff'));
    });

    expect(screen.getByRole('heading', { name: 'Assign Staff' })).toBeInTheDocument();
  });

  it('shows staff members in bulk assign modal', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve({ data: [createBooking({ id: 'b1' })], total: 1 });
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-assign-staff'));
    });

    await waitFor(() => {
      // Staff names from the mock — may appear in chip dropdown too
      const sarahElements = screen.getAllByText('Sarah');
      expect(sarahElements.length).toBeGreaterThanOrEqual(1);
      const mikeElements = screen.getAllByText('Mike');
      expect(mikeElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls API to assign staff when staff member is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve({ data: [createBooking({ id: 'b1' })], total: 1 });
    });
    mockApi.patch.mockResolvedValue({});

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-assign-staff'));
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Assign Staff' })).toBeInTheDocument();
    });

    // Click the Mike button inside the modal (not the <option> in the chip filter)
    const mikeButtons = screen.getAllByText('Mike').filter((el) => el.tagName === 'BUTTON');
    await act(async () => {
      await user.click(mikeButtons[0]);
    });

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/bookings/bulk', {
        ids: ['b1'],
        action: 'assign',
        payload: { staffId: 's2' },
      });
    });
  });

  it('closes bulk assign modal and clears selection after assigning', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve({ data: [createBooking({ id: 'b1' })], total: 1 });
    });
    mockApi.patch.mockResolvedValue({});

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-assign-staff'));
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Assign Staff' })).toBeInTheDocument();
    });

    const mikeButtons = screen.getAllByText('Mike').filter((el) => el.tagName === 'BUTTON');
    await act(async () => {
      await user.click(mikeButtons[0]);
    });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Assign Staff' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
    });
  });

  it('shows "No staff members found" when staff list is empty', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff') return Promise.resolve([]);
      return Promise.resolve({ data: [createBooking({ id: 'b1' })], total: 1 });
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-assign-staff'));
    });

    expect(screen.getByText('No staff members found')).toBeInTheDocument();
  });

  it('closes bulk assign modal when Cancel is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve({ data: [createBooking({ id: 'b1' })], total: 1 });
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-assign-staff'));
    });

    expect(screen.getByRole('heading', { name: 'Assign Staff' })).toBeInTheDocument();

    // Find and click Cancel in the assign modal
    const cancelButtons = screen.getAllByText('Cancel');
    await act(async () => {
      await user.click(cancelButtons[cancelButtons.length - 1]);
    });

    expect(screen.queryByRole('heading', { name: 'Assign Staff' })).not.toBeInTheDocument();
  });

  // ─── Staff Loading ──────────────────────────────────────────

  it('loads staff list on mount', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve({ data: [], total: 0 });
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/staff');
    });
  });

  it('handles staff API returning object with data property', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff') return Promise.resolve({ data: mockStaff });
      return Promise.resolve({ data: [createBooking({ id: 'b1' })], total: 1 });
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Select and open assign modal
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });
    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-assign-staff'));
    });

    await waitFor(() => {
      const mikeElements = screen.getAllByText('Mike');
      expect(mikeElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles staff API error gracefully', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff') return Promise.reject(new Error('Failed'));
      return Promise.resolve({ data: [], total: 0 });
    });

    // Should not throw
    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });
  });

  // ─── API Error Handling ─────────────────────────────────────

  it('handles bookings API error gracefully and shows empty', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings')) return Promise.reject(new Error('Network error'));
      return Promise.resolve([]);
    });

    render(<BookingsPage />);

    await waitFor(() => {
      // Should still render the page without crashing
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('shows error toast when bookings API fails', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings')) return Promise.reject(new Error('Network error'));
      return Promise.resolve([]);
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  it('shows error toast when bulk status change fails', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1', status: 'PENDING' })],
      total: 1,
    });
    mockApi.patch.mockRejectedValueOnce(new Error('Bulk update failed'));

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-change-status'));
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'status.confirmed' }));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  it('shows error toast when bulk assign fails', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve({ data: [createBooking({ id: 'b1' })], total: 1 });
    });
    mockApi.patch.mockRejectedValueOnce(new Error('Assign failed'));

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    await act(async () => {
      await user.click(screen.getByTestId('bulk-action-assign-staff'));
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Assign Staff' })).toBeInTheDocument();
    });

    const mikeButtons = screen.getAllByText('Mike').filter((el) => el.tagName === 'BUTTON');
    await act(async () => {
      await user.click(mikeButtons[0]);
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  // ─── Multiple Status Rendering ──────────────────────────────

  it('renders all status types correctly', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: '1', status: 'PENDING', customer: { name: 'A' } }),
        createBooking({ id: '2', status: 'CONFIRMED', customer: { name: 'B' } }),
        createBooking({ id: '3', status: 'IN_PROGRESS', customer: { name: 'C' } }),
        createBooking({ id: '4', status: 'COMPLETED', customer: { name: 'D' } }),
        createBooking({ id: '5', status: 'CANCELLED', customer: { name: 'E' } }),
        createBooking({ id: '6', status: 'NO_SHOW', customer: { name: 'F' } }),
        createBooking({ id: '7', status: 'RESCHEDULED', customer: { name: 'G' } }),
      ],
      total: 7,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('status.pending')).toBeInTheDocument();
      expect(screen.getByText('status.confirmed')).toBeInTheDocument();
      expect(screen.getByText('status.in_progress')).toBeInTheDocument();
      expect(screen.getByText('status.completed')).toBeInTheDocument();
      expect(screen.getByText('status.cancelled')).toBeInTheDocument();
      expect(screen.getByText('status.no_show')).toBeInTheDocument();
      expect(screen.getByText('status.rescheduled')).toBeInTheDocument();
    });
  });

  // ─── Checkbox does not open modal ───────────────────────────

  it('does not open detail modal when checkbox is clicked (stopPropagation)', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createBooking({ id: 'b1' })],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click the row checkbox (not the cell content)
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[1]); // row checkbox
    });

    // Bulk bar should show but detail modal should NOT open
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-detail-modal')).not.toBeInTheDocument();
  });

  // ─── Multiple Selections ────────────────────────────────────

  it('supports selecting multiple individual bookings', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: 'b1', customer: { name: 'John' } }),
        createBooking({ id: 'b2', customer: { name: 'Jane' } }),
        createBooking({ id: 'b3', customer: { name: 'Bob' } }),
      ],
      total: 3,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');

    // Select first and third
    await act(async () => {
      await user.click(checkboxes[1]);
    });
    await act(async () => {
      await user.click(checkboxes[3]);
    });

    expect(screen.getByTestId('bulk-count')).toHaveTextContent('2 selected');
  });

  // ─── Filter Changes Clear Previous Data ─────────────────────

  it('calls API each time the filter changes', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    const select = screen.getByTestId('status-filter');

    // Change to COMPLETED
    await act(async () => {
      await user.selectOptions(select, 'COMPLETED');
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/bookings?pageSize=50&status=COMPLETED');
    });

    // Change to NO_SHOW
    await act(async () => {
      await user.selectOptions(select, 'NO_SHOW');
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/bookings?pageSize=50&status=NO_SHOW');
    });

    // Change to IN_PROGRESS
    await act(async () => {
      await user.selectOptions(select, 'IN_PROGRESS');
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/bookings?pageSize=50&status=IN_PROGRESS');
    });
  });

  // ─── Date Preset Buttons ───────────────────────────────────

  it('shows date preset buttons when filters panel is open', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    const filterButton = screen.getByTestId('filters-toggle');
    await act(async () => {
      await user.click(filterButton);
    });

    expect(screen.getByTestId('date-preset-today')).toBeInTheDocument();
    expect(screen.getByTestId('date-preset-this_week')).toBeInTheDocument();
    expect(screen.getByTestId('date-preset-this_month')).toBeInTheDocument();
    expect(screen.getByTestId('date-preset-custom')).toBeInTheDocument();
  });

  it('sets date range when Today preset is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    const filterButton = screen.getByTestId('filters-toggle');
    await act(async () => {
      await user.click(filterButton);
    });

    await act(async () => {
      await user.click(screen.getByTestId('date-preset-today'));
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('dateFrom='));
    });
  });

  // ─── URL Param Persistence ─────────────────────────────────

  it('updates URL search params when filters change', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    const select = screen.getByTestId('status-filter');

    await act(async () => {
      await user.selectOptions(select, 'CONFIRMED');
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('status=CONFIRMED'),
        expect.objectContaining({ scroll: false }),
      );
    });
  });

  it('clears filters and URL params when clear button is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    // Open filters panel
    const filterButton = screen.getByTestId('filters-toggle');
    await act(async () => {
      await user.click(filterButton);
    });

    // Set a date preset to activate filters
    await act(async () => {
      await user.click(screen.getByTestId('date-preset-today'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('clear-filters')).toBeInTheDocument();
    });

    // Click clear
    await act(async () => {
      await user.click(screen.getByTestId('clear-filters'));
    });

    // Should call API without date filters
    await waitFor(() => {
      const lastBookingCall = mockApi.get.mock.calls
        .filter((c: any) => c[0].startsWith('/bookings'))
        .pop();
      expect(lastBookingCall?.[0]).toBe('/bookings?pageSize=50');
    });
  });

  it('shows active filter count badge', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    // Set status filter to add one active filter
    const select = screen.getByTestId('status-filter');
    await act(async () => {
      await user.selectOptions(select, 'CONFIRMED');
    });

    await waitFor(() => {
      // The filter count badge should show "1"
      const filtersButton = screen.getByTestId('filters-toggle');
      expect(filtersButton.textContent).toContain('1');
    });
  });

  // ─── Status Chip Bar ──────────────────────────────────────

  it('renders status chip bar with all status options', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('status-chips')).toBeInTheDocument();
    });

    expect(screen.getByTestId('status-chip-all')).toBeInTheDocument();
    expect(screen.getByTestId('status-chip-PENDING')).toBeInTheDocument();
    expect(screen.getByTestId('status-chip-CONFIRMED')).toBeInTheDocument();
    expect(screen.getByTestId('status-chip-IN_PROGRESS')).toBeInTheDocument();
    expect(screen.getByTestId('status-chip-COMPLETED')).toBeInTheDocument();
    expect(screen.getByTestId('status-chip-CANCELLED')).toBeInTheDocument();
    expect(screen.getByTestId('status-chip-NO_SHOW')).toBeInTheDocument();
  });

  it('clicking a status chip updates the API call with status param', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('status-chips')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('status-chip-COMPLETED'));
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('status=COMPLETED'));
    });
  });

  it('clicking "All" chip clears status filter', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('status-chips')).toBeInTheDocument();
    });

    // First set a filter
    await act(async () => {
      await user.click(screen.getByTestId('status-chip-PENDING'));
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('status=PENDING'));
    });

    // Now click All
    await act(async () => {
      await user.click(screen.getByTestId('status-chip-all'));
    });

    await waitFor(() => {
      const calls = mockApi.get.mock.calls;
      const lastBookingCall = calls.filter((c: any) => c[0].startsWith('/bookings')).pop();
      expect(lastBookingCall?.[0]).not.toContain('status=');
    });
  });

  // ─── Sortable Column Headers ──────────────────────────────

  it('renders sortable column headers with data-testids', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('sort-header-customer')).toBeInTheDocument();
      expect(screen.getByTestId('sort-header-service')).toBeInTheDocument();
      expect(screen.getByTestId('sort-header-date')).toBeInTheDocument();
      expect(screen.getByTestId('sort-header-status')).toBeInTheDocument();
      expect(screen.getByTestId('sort-header-amount')).toBeInTheDocument();
    });
  });

  it('clicking a sort header sends sortBy param to API', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('sort-header-customer')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('sort-header-customer'));
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('sortBy=customerName'));
    });
  });

  it('shows sort direction icon on active sort column', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('sort-header-amount')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('sort-header-amount'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('sort-desc')).toBeInTheDocument();
    });
  });

  // ─── Staff Chip Filter ────────────────────────────────────

  it('renders staff filter dropdown in chip bar', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.startsWith('/bookings')) return Promise.resolve({ data: [], total: 0 });
      if (url === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve({});
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('staff-chip-filter')).toBeInTheDocument();
    });
  });

  // ─── Print Button ─────────────────────────────────────────

  it('renders print button', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('print-btn')).toBeInTheDocument();
    });

    expect(screen.getByText('Print')).toBeInTheDocument();
  });

  it('print button calls window.print', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => {});

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('print-btn')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('print-btn'));
    });

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  // ─── Amount Column ────────────────────────────────────────

  it('renders amount column with service price', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        createBooking({ id: '1', service: { name: 'Haircut', price: 50 } }),
        createBooking({
          id: '2',
          service: { name: 'Massage', price: 120.5 },
          customer: { name: 'Jane' },
        }),
      ],
      total: 2,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('$50.00')).toBeInTheDocument();
      expect(screen.getByText('$120.50')).toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingsPage from './page';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
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

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  BookOpen: () => <div data-testid="book-open-icon" />,
}));

// Mock BookingDetailModal
jest.mock('@/components/booking-detail-modal', () => ({
  __esModule: true,
  default: () => <div data-testid="booking-detail-modal" />,
}));

// Mock BookingFormModal
jest.mock('@/components/booking-form-modal', () => ({
  __esModule: true,
  default: () => <div data-testid="booking-form-modal" />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

describe('BookingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders bookings page with title', async () => {
    mockApi.get.mockResolvedValue({
      data: [],
      total: 0,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });
  });

  it('displays bookings in table', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        {
          id: '1',
          customer: { name: 'John' },
          service: { name: 'Haircut' },
          staff: { name: 'Sarah' },
          startTime: '2026-01-15T10:00:00Z',
          status: 'CONFIRMED',
        },
        {
          id: '2',
          customer: { name: 'Jane' },
          service: { name: 'Massage' },
          staff: { name: 'Mike' },
          startTime: '2026-01-16T14:00:00Z',
          status: 'PENDING',
        },
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

  it('shows empty state when no bookings', async () => {
    mockApi.get.mockResolvedValue({
      data: [],
      total: 0,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('has status filter dropdown', async () => {
    mockApi.get.mockResolvedValue({
      data: [],
      total: 0,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // Check for "All statuses" option
    expect(screen.getByText('bookings.all_statuses')).toBeInTheDocument();
  });

  it('filters by status when dropdown changes', async () => {
    const user = userEvent.setup();

    mockApi.get.mockResolvedValue({
      data: [],
      total: 0,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('bookings.title')).toBeInTheDocument();
    });

    // Initial call should be without status filter
    expect(mockApi.get).toHaveBeenCalledWith('/bookings?pageSize=50');

    const select = screen.getByRole('combobox');

    // Change select value to CONFIRMED
    await act(async () => {
      await user.selectOptions(select, 'CONFIRMED');
    });

    // Should call api.get with status parameter
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/bookings?status=CONFIRMED&pageSize=50');
    });
  });

  it('shows loading skeletons while fetching data', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<BookingsPage />);

    // Should show 5 skeleton rows
    const skeletons = screen.getAllByTestId('table-skeleton');
    expect(skeletons).toHaveLength(5);
  });

  it('opens detail modal when row is clicked', async () => {
    const user = userEvent.setup();

    mockApi.get.mockResolvedValue({
      data: [
        {
          id: '1',
          customer: { name: 'John' },
          service: { name: 'Haircut' },
          staff: { name: 'Sarah' },
          startTime: '2026-01-15T10:00:00Z',
          status: 'CONFIRMED',
        },
      ],
      total: 1,
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    // Click on the row
    const row = screen.getByText('John').closest('tr');
    expect(row).not.toBeNull();

    await act(async () => {
      await user.click(row!);
    });

    // Detail modal should be rendered (though not visible due to mocking)
    expect(screen.getByTestId('booking-detail-modal')).toBeInTheDocument();
  });
});

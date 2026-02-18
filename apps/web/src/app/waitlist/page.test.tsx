import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WaitlistPage from './page';

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

// Mock saved-views
jest.mock('@/components/saved-views', () => ({
  ViewPicker: (props: any) => <div data-testid="view-picker" />,
  SaveViewModal: () => null,
}));

// Mock tooltip-nudge
jest.mock('@/components/tooltip-nudge', () => ({
  __esModule: true,
  default: ({ id, title, description }: any) => (
    <div data-testid={`tooltip-${id}`}>
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ClipboardList: () => <div data-testid="clipboard-list-icon" />,
  X: () => <div data-testid="x-icon" />,
  CheckCircle2: (props: any) => <div data-testid="check-circle2-icon" {...props} />,
  Clock: (props: any) => <div data-testid="clock-icon" {...props} />,
  AlertCircle: (props: any) => <div data-testid="alert-circle-icon" {...props} />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const createEntry = (overrides: any = {}) => ({
  id: 'w1',
  customer: { name: 'John Doe', phone: '+1234567890' },
  service: { name: 'Haircut' },
  staff: { name: 'Sarah' },
  status: 'ACTIVE',
  timeWindowStart: null,
  timeWindowEnd: null,
  notes: 'Morning preferred',
  createdAt: '2026-02-10T10:00:00Z',
  ...overrides,
});

const mockServices = [
  { id: 's1', name: 'Haircut' },
  { id: 's2', name: 'Massage' },
];

describe('WaitlistPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    jest.spyOn(window, 'prompt').mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setupMocks = (entries: any[] = []) => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/waitlist')) return Promise.resolve(entries);
      if (path === '/services') return Promise.resolve(mockServices);
      return Promise.resolve({});
    });
  };

  // ─── Page Header ────────────────────────────────────────────

  it('renders page title', async () => {
    setupMocks();

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('Waitlist')).toBeInTheDocument();
    });
  });

  // ─── Loading State ──────────────────────────────────────────

  it('shows loading skeletons while fetching', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));

    render(<WaitlistPage />);

    const skeletons = screen.getAllByTestId('table-skeleton');
    expect(skeletons).toHaveLength(5);
  });

  // ─── Empty State ────────────────────────────────────────────

  it('shows empty state when no entries', async () => {
    setupMocks([]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No waitlist entries')).toBeInTheDocument();
    });
  });

  // ─── Entry Rendering ───────────────────────────────────────

  it('displays waitlist entries in table', async () => {
    setupMocks([
      createEntry({
        id: 'w1',
        customer: { name: 'Alice', phone: '+1111' },
        service: { name: 'Facial' },
      }),
      createEntry({
        id: 'w2',
        customer: { name: 'Bob', phone: '+2222' },
        service: { name: 'Waxing' },
      }),
    ]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Facial')).toBeInTheDocument();
      expect(screen.getByText('Waxing')).toBeInTheDocument();
    });
  });

  it('renders table column headers', async () => {
    setupMocks([]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Preferred Staff')).toBeInTheDocument();
      expect(screen.getByText('Time Window')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Added')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  it('shows customer phone number', async () => {
    setupMocks([createEntry({ customer: { name: 'John', phone: '+1234567890' } })]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('+1234567890')).toBeInTheDocument();
    });
  });

  it('shows Any when staff is null', async () => {
    setupMocks([createEntry({ staff: null })]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('Any')).toBeInTheDocument();
    });
  });

  it('shows preferred staff name', async () => {
    setupMocks([createEntry({ staff: { name: 'Dr. Smith' } })]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    });
  });

  it('shows time window when both start and end set', async () => {
    setupMocks([createEntry({ timeWindowStart: '09:00', timeWindowEnd: '12:00' })]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('09:00 - 12:00')).toBeInTheDocument();
    });
  });

  it('shows notes when no time window set', async () => {
    setupMocks([
      createEntry({ timeWindowStart: null, timeWindowEnd: null, notes: 'Mornings only' }),
    ]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('Mornings only')).toBeInTheDocument();
    });
  });

  // ─── Status Badges ─────────────────────────────────────────

  it('renders status badges', async () => {
    setupMocks([
      createEntry({ id: 'w1', status: 'ACTIVE', customer: { name: 'A', phone: '1' } }),
      createEntry({ id: 'w2', status: 'OFFERED', customer: { name: 'B', phone: '2' } }),
      createEntry({ id: 'w3', status: 'BOOKED', customer: { name: 'C', phone: '3' } }),
    ]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('OFFERED')).toBeInTheDocument();
      expect(screen.getByText('BOOKED')).toBeInTheDocument();
    });
  });

  // ─── Filters ───────────────────────────────────────────────

  it('has status filter dropdown', async () => {
    setupMocks([]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
    });
  });

  it('has service filter dropdown', async () => {
    setupMocks([]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('All Services')).toBeInTheDocument();
    });
  });

  it('filters by status when status filter changes', async () => {
    const user = userEvent.setup();
    setupMocks([]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[0];

    await act(async () => {
      await user.selectOptions(statusSelect, 'ACTIVE');
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/waitlist?status=ACTIVE');
    });
  });

  // ─── Actions ───────────────────────────────────────────────

  it('shows Resolve and Cancel buttons for ACTIVE entries', async () => {
    setupMocks([createEntry({ status: 'ACTIVE' })]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('Resolve')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('shows Cancel button for OFFERED entries', async () => {
    setupMocks([createEntry({ id: 'w1', status: 'OFFERED' })]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.queryByText('Resolve')).not.toBeInTheDocument();
    });
  });

  it('calls delete API when Cancel is clicked', async () => {
    const user = userEvent.setup();
    setupMocks([createEntry({ id: 'w1', status: 'ACTIVE' })]);
    mockApi.del.mockResolvedValue({});

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Cancel'));
    });

    await waitFor(() => {
      expect(mockApi.del).toHaveBeenCalledWith('/waitlist/w1');
    });
  });

  // ─── Tooltip Nudge ──────────────────────────────────────────

  it('renders waitlist intro tooltip nudge', async () => {
    setupMocks([]);

    render(<WaitlistPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tooltip-waitlist-intro')).toBeInTheDocument();
    });
  });
});

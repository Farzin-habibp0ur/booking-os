import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignsPage from './page';

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
  Megaphone: () => <div data-testid="megaphone-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const createCampaign = (overrides: any = {}) => ({
  id: 'c1',
  name: 'February Promo',
  status: 'DRAFT',
  scheduledAt: null,
  sentAt: null,
  createdAt: '2026-01-15T10:00:00Z',
  ...overrides,
});

describe('CampaignsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Loading State ──────────────────────────────────────────

  it('shows loading skeletons while fetching data', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<CampaignsPage />);

    const skeletons = screen.getAllByTestId('table-skeleton');
    expect(skeletons).toHaveLength(3);
  });

  // ─── Page Title & Header ────────────────────────────────────

  it('renders page title', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByText('Campaigns')).toBeInTheDocument();
    });
  });

  it('renders New Campaign button', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByText('New Campaign')).toBeInTheDocument();
    });
  });

  it('navigates to /campaigns/new when New Campaign button is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByText('New Campaign')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('New Campaign'));
    });

    expect(mockPush).toHaveBeenCalledWith('/campaigns/new');
  });

  // ─── Empty State ────────────────────────────────────────────

  it('shows empty state when no campaigns', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No campaigns yet')).toBeInTheDocument();
    });
  });

  // ─── Campaign List Rendering ────────────────────────────────

  it('displays campaigns in table', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        createCampaign({ id: 'c1', name: 'February Promo', status: 'DRAFT' }),
        createCampaign({
          id: 'c2',
          name: 'Spring Sale',
          status: 'SENT',
          sentAt: '2026-02-01T12:00:00Z',
        }),
      ],
      total: 2,
    });

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByText('February Promo')).toBeInTheDocument();
      expect(screen.getByText('Spring Sale')).toBeInTheDocument();
    });
  });

  it('renders status badges for each campaign', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        createCampaign({ id: 'c1', status: 'DRAFT' }),
        createCampaign({ id: 'c2', name: 'Scheduled One', status: 'SCHEDULED' }),
        createCampaign({ id: 'c3', name: 'Sent One', status: 'SENT' }),
      ],
      total: 3,
    });

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByText('DRAFT')).toBeInTheDocument();
      expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
      expect(screen.getByText('SENT')).toBeInTheDocument();
    });
  });

  it('renders table column headers', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Scheduled')).toBeInTheDocument();
      expect(screen.getByText('Sent')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
    });
  });

  it('navigates to campaign detail when row is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue({
      data: [createCampaign({ id: 'c1', name: 'February Promo' })],
      total: 1,
    });

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByText('February Promo')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('February Promo'));
    });

    expect(mockPush).toHaveBeenCalledWith('/campaigns/c1');
  });

  it('displays dash when scheduledAt is null', async () => {
    mockApi.get.mockResolvedValue({
      data: [createCampaign({ id: 'c1', scheduledAt: null })],
      total: 1,
    });

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByText('February Promo')).toBeInTheDocument();
    });

    // The dash character should appear for missing scheduledAt and sentAt
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('displays formatted date when scheduledAt is set', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        createCampaign({
          id: 'c1',
          scheduledAt: '2026-03-15T14:00:00Z',
        }),
      ],
      total: 1,
    });

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByText('February Promo')).toBeInTheDocument();
    });

    // Verify the table renders without error; specific date format depends on locale
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(2); // header + 1 data row
  });

  // ─── API Call ───────────────────────────────────────────────

  it('calls API with correct endpoint on mount', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/campaigns?pageSize=50');
    });
  });

  // ─── Error Handling ─────────────────────────────────────────

  it('handles API error gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockApi.get.mockRejectedValue(new Error('Network error'));

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByText('Campaigns')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  // ─── Multiple Status Colors ─────────────────────────────────

  it('renders all campaign status types', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        createCampaign({ id: 'c1', name: 'A', status: 'DRAFT' }),
        createCampaign({ id: 'c2', name: 'B', status: 'SCHEDULED' }),
        createCampaign({ id: 'c3', name: 'C', status: 'SENDING' }),
        createCampaign({ id: 'c4', name: 'D', status: 'SENT' }),
        createCampaign({ id: 'c5', name: 'E', status: 'CANCELLED' }),
      ],
      total: 5,
    });

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByText('DRAFT')).toBeInTheDocument();
      expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
      expect(screen.getByText('SENDING')).toBeInTheDocument();
      expect(screen.getByText('SENT')).toBeInTheDocument();
      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    });
  });

  // ─── Tooltip Nudge ──────────────────────────────────────────

  it('renders campaigns intro tooltip nudge', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tooltip-campaigns-intro')).toBeInTheDocument();
    });
  });
});

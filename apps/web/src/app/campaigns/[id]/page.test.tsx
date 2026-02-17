import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignDetailPage from './page';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'c1' }),
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

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ArrowLeft: () => <div data-testid="arrow-left-icon" />,
  Send: () => <div data-testid="send-icon" />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const createCampaignDetail = (overrides: any = {}) => ({
  id: 'c1',
  name: 'February Promo',
  status: 'DRAFT',
  scheduledAt: null,
  sentAt: null,
  createdAt: '2026-01-15T10:00:00Z',
  throttlePerMinute: 10,
  filters: {},
  stats: {},
  ...overrides,
});

describe('CampaignDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Loading State ──────────────────────────────────────────

  it('shows loading state while fetching', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));

    render(<CampaignDetailPage />);

    // The loading state renders pulse skeleton divs
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  // ─── Campaign Detail Render ─────────────────────────────────

  it('renders campaign name and status badge', async () => {
    mockApi.get.mockResolvedValue(createCampaignDetail());

    render(<CampaignDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('February Promo')).toBeInTheDocument();
      expect(screen.getByText('DRAFT')).toBeInTheDocument();
    });
  });

  it('renders back to campaigns button', async () => {
    mockApi.get.mockResolvedValue(createCampaignDetail());

    render(<CampaignDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Back to Campaigns')).toBeInTheDocument();
    });
  });

  it('navigates back to campaigns list when back button clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue(createCampaignDetail());

    render(<CampaignDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Back to Campaigns')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Back to Campaigns'));
    });

    expect(mockPush).toHaveBeenCalledWith('/campaigns');
  });

  // ─── Metrics Display for SENT Campaigns ─────────────────────

  it('displays metrics for SENT campaign', async () => {
    mockApi.get.mockResolvedValue(
      createCampaignDetail({
        status: 'SENT',
        sentAt: '2026-02-01T12:00:00Z',
        stats: {
          sent: 120,
          delivered: 115,
          read: 80,
          bookings: 12,
        },
      }),
    );

    render(<CampaignDetailPage />);

    // First wait for the campaign name to confirm data loaded
    await waitFor(() => {
      expect(screen.getByText('February Promo')).toBeInTheDocument();
      expect(screen.getByText('SENT')).toBeInTheDocument();
    });

    // Then check the stats grid
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('115')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.getByText('Bookings')).toBeInTheDocument();
  });

  it('does not show stats grid for DRAFT campaign', async () => {
    mockApi.get.mockResolvedValue(createCampaignDetail({ status: 'DRAFT' }));

    render(<CampaignDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('February Promo')).toBeInTheDocument();
    });

    // The labels Sent, Delivered etc as stat cards should not be present
    // (Note: "Sent" can appear in the details section, but not as a stats label)
    expect(screen.queryByText('Delivered')).not.toBeInTheDocument();
    expect(screen.queryByText('Read')).not.toBeInTheDocument();
    expect(screen.queryByText('Bookings')).not.toBeInTheDocument();
  });

  // ─── Send & Delete Actions ──────────────────────────────────

  it('shows Send Now and Delete buttons for DRAFT campaign', async () => {
    mockApi.get.mockResolvedValue(createCampaignDetail({ status: 'DRAFT' }));

    render(<CampaignDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Send Now')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  it('does not show Send Now for SENT campaign', async () => {
    mockApi.get.mockResolvedValue(createCampaignDetail({ status: 'SENT' }));

    render(<CampaignDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('February Promo')).toBeInTheDocument();
    });

    expect(screen.queryByText('Send Now')).not.toBeInTheDocument();
  });

  it('calls send API when Send Now is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue(createCampaignDetail({ status: 'DRAFT' }));
    mockApi.post.mockResolvedValue({});

    render(<CampaignDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Send Now')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Send Now'));
    });

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/campaigns/c1/send');
    });
  });

  // ─── Details Section ────────────────────────────────────────

  it('renders campaign details with throttle', async () => {
    mockApi.get.mockResolvedValue(createCampaignDetail({ throttlePerMinute: 15 }));

    render(<CampaignDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Details')).toBeInTheDocument();
      expect(screen.getByText('Throttle')).toBeInTheDocument();
      expect(screen.getByText('15 msg/min')).toBeInTheDocument();
    });
  });

  // ─── Not Found / Error ─────────────────────────────────────

  it('redirects to campaigns list on API error', async () => {
    mockApi.get.mockRejectedValue(new Error('Not found'));

    render(<CampaignDetailPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/campaigns');
    });
  });
});

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignFilterBuilder from './campaign-filter-builder';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
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
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

// Mock i18n
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  I18nProvider: ({ children }: any) => children,
}));

// Mock vertical-pack
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
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
  },
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Plus: (props: any) => <div data-testid="plus-icon" {...props} />,
  Trash2: (props: any) => <div data-testid="trash-icon" {...props} />,
  Save: (props: any) => <div data-testid="save-icon" {...props} />,
  FolderOpen: (props: any) => <div data-testid="folder-icon" {...props} />,
  Users: (props: any) => <div data-testid="users-icon" {...props} />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

describe('CampaignFilterBuilder', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockApi.get.mockResolvedValue([]);
    mockApi.post.mockResolvedValue({ count: 42 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the component with title', async () => {
    await act(async () => {
      render(<CampaignFilterBuilder filters={{}} onChange={mockOnChange} />);
    });

    expect(screen.getByText('campaigns.filter_builder.audience_filters')).toBeInTheDocument();
  });

  it('renders Add Filter button', async () => {
    await act(async () => {
      render(<CampaignFilterBuilder filters={{}} onChange={mockOnChange} />);
    });

    expect(screen.getByTestId('add-rule-btn')).toBeInTheDocument();
    expect(screen.getByText('campaigns.filter_builder.add_filter')).toBeInTheDocument();
  });

  it('adds a filter rule when Add Filter is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await act(async () => {
      render(<CampaignFilterBuilder filters={{}} onChange={mockOnChange} />);
    });

    await act(async () => {
      await user.click(screen.getByTestId('add-rule-btn'));
    });

    const rules = screen.getAllByTestId('filter-rule');
    expect(rules).toHaveLength(1);
  });

  it('removes a filter rule', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await act(async () => {
      render(<CampaignFilterBuilder filters={{}} onChange={mockOnChange} />);
    });

    // Add a rule
    await act(async () => {
      await user.click(screen.getByTestId('add-rule-btn'));
    });

    expect(screen.getAllByTestId('filter-rule')).toHaveLength(1);

    // Remove the rule
    await act(async () => {
      await user.click(screen.getByLabelText('Remove filter'));
    });

    expect(screen.queryAllByTestId('filter-rule')).toHaveLength(0);
  });

  it('shows preview count after debounced fetch', async () => {
    await act(async () => {
      render(<CampaignFilterBuilder filters={{}} onChange={mockOnChange} />);
    });

    // Advance past the debounce timer
    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(screen.getByTestId('preview-badge')).toHaveTextContent('42');
    });
  });

  it('calls audience-preview endpoint', async () => {
    await act(async () => {
      render(<CampaignFilterBuilder filters={{}} onChange={mockOnChange} />);
    });

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/campaigns/audience-preview', {
        filters: expect.any(Object),
      });
    });
  });

  it('shows Save as Segment button', async () => {
    await act(async () => {
      render(<CampaignFilterBuilder filters={{}} onChange={mockOnChange} />);
    });

    expect(screen.getByTestId('save-segment-btn')).toBeInTheDocument();
  });

  it('opens save segment modal', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await act(async () => {
      render(<CampaignFilterBuilder filters={{}} onChange={mockOnChange} />);
    });

    await act(async () => {
      await user.click(screen.getByTestId('save-segment-btn'));
    });

    expect(screen.getByTestId('save-segment-modal')).toBeInTheDocument();
    expect(screen.getByTestId('segment-name-input')).toBeInTheDocument();
  });

  it('saves a segment', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockApi.post.mockImplementation((path: string) => {
      if (path === '/campaigns/segments')
        return Promise.resolve({ id: 'seg1', name: 'My Segment', filters: {} });
      return Promise.resolve({ count: 42 });
    });

    await act(async () => {
      render(<CampaignFilterBuilder filters={{}} onChange={mockOnChange} />);
    });

    // Open modal
    await act(async () => {
      await user.click(screen.getByTestId('save-segment-btn'));
    });

    // Type name
    await act(async () => {
      await user.type(screen.getByTestId('segment-name-input'), 'My Segment');
    });

    // Click save
    await act(async () => {
      await user.click(screen.getByTestId('confirm-save-segment'));
    });

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/campaigns/segments', {
        name: 'My Segment',
        filters: expect.any(Object),
      });
    });
  });

  it('shows Load Segment button', async () => {
    await act(async () => {
      render(<CampaignFilterBuilder filters={{}} onChange={mockOnChange} />);
    });

    expect(screen.getByTestId('load-segment-btn')).toBeInTheDocument();
  });

  it('shows segment dropdown with no segments message', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await act(async () => {
      render(<CampaignFilterBuilder filters={{}} onChange={mockOnChange} />);
    });

    await act(async () => {
      await user.click(screen.getByTestId('load-segment-btn'));
    });

    expect(screen.getByTestId('segment-dropdown')).toBeInTheDocument();
    expect(screen.getByText('campaigns.filter_builder.no_saved_segments')).toBeInTheDocument();
  });

  it('loads segments from API and displays in dropdown', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockApi.get.mockResolvedValue([
      { id: 'seg1', name: 'VIP Customers', filters: { tags: ['vip'] } },
    ]);

    await act(async () => {
      render(<CampaignFilterBuilder filters={{}} onChange={mockOnChange} />);
    });

    await act(async () => {
      await user.click(screen.getByTestId('load-segment-btn'));
    });

    await waitFor(() => {
      expect(screen.getByText('VIP Customers')).toBeInTheDocument();
    });
  });

  it('populates rules when loading a segment', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockApi.get.mockResolvedValue([
      { id: 'seg1', name: 'VIP Customers', filters: { tags: ['vip'], lastVisitDaysAgo: 30 } },
    ]);

    await act(async () => {
      render(<CampaignFilterBuilder filters={{}} onChange={mockOnChange} />);
    });

    // Open dropdown
    await act(async () => {
      await user.click(screen.getByTestId('load-segment-btn'));
    });

    // Wait for segments to load, then click
    await waitFor(() => {
      expect(screen.getByText('VIP Customers')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('VIP Customers'));
    });

    // Should have 2 filter rules (tags + lastVisitDaysAgo)
    await waitFor(() => {
      expect(screen.getAllByTestId('filter-rule')).toHaveLength(2);
    });
  });

  it('initializes rules from existing filters prop', async () => {
    await act(async () => {
      render(
        <CampaignFilterBuilder
          filters={{ tags: ['vip'], noUpcomingBooking: true }}
          onChange={mockOnChange}
        />,
      );
    });

    expect(screen.getAllByTestId('filter-rule')).toHaveLength(2);
  });
});

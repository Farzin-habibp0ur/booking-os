import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewCampaignPage from './page';

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

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ArrowLeft: () => <div data-testid="arrow-left-icon" />,
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
  Users: (props: any) => <div data-testid="users-icon" {...props} />,
  MessageSquare: (props: any) => <div data-testid="message-square-icon" {...props} />,
  Clock: (props: any) => <div data-testid="clock-icon" {...props} />,
  CheckCircle: (props: any) => <div data-testid="check-circle-icon" {...props} />,
  FlaskConical: (props: any) => <div data-testid="flask-icon" {...props} />,
  Plus: (props: any) => <div data-testid="plus-icon" {...props} />,
  Trash2: (props: any) => <div data-testid="trash-icon" {...props} />,
}));

// Mock crypto.randomUUID
let uuidCounter = 0;
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => `uuid-${++uuidCounter}`,
  },
});

// Mock CampaignFilterBuilder — renders a simple stub
jest.mock('@/components/campaign-filter-builder', () => {
  return function MockCampaignFilterBuilder({ filters, onChange }: any) {
    return <div data-testid="campaign-filter-builder">Audience Filters (mock)</div>;
  };
});

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const mockTemplates = [
  { id: 't1', name: 'Re-engagement', body: 'Hi {{name}}, we miss you!' },
  { id: 't2', name: 'Promo Offer', body: 'Special offer just for you' },
];

describe('NewCampaignPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock: templates and preview
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/templates') return Promise.resolve(mockTemplates);
      return Promise.resolve({});
    });
    mockApi.post.mockImplementation((path: string) => {
      if (path.includes('preview') || path.includes('audience'))
        return Promise.resolve({ count: 25, samples: [] });
      return Promise.resolve({ id: 'new-campaign-id' });
    });
  });

  // ─── Initial Render ─────────────────────────────────────────

  it('renders page title', async () => {
    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('New Campaign')).toBeInTheDocument();
    });
  });

  it('renders step indicators', async () => {
    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('Audience')).toBeInTheDocument();
      expect(screen.getByText('Message')).toBeInTheDocument();
      expect(screen.getByText('Schedule')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });
  });

  it('renders back to campaigns button', async () => {
    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('Back to Campaigns')).toBeInTheDocument();
    });
  });

  it('navigates back to campaigns when back button is clicked', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('Back to Campaigns')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Back to Campaigns'));
    });

    expect(mockPush).toHaveBeenCalledWith('/campaigns');
  });

  // ─── Step 0: Audience ───────────────────────────────────────

  it('renders audience filter builder on first step', async () => {
    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByTestId('campaign-filter-builder')).toBeInTheDocument();
    });
  });

  it('shows audience preview count', async () => {
    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('matching customers')).toBeInTheDocument();
    });
  });

  it('renders filter builder component', async () => {
    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByTestId('campaign-filter-builder')).toBeInTheDocument();
    });
  });

  it('disables Next button when audience count is 0', async () => {
    mockApi.post.mockResolvedValue({ count: 0, samples: [] });

    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByTestId('campaign-filter-builder')).toBeInTheDocument();
    });

    // Wait for preview to load with count 0
    await waitFor(() => {
      const nextBtn = screen.getByText('Next');
      expect(nextBtn).toBeDisabled();
    });
  });

  // ─── Step Navigation ────────────────────────────────────────

  it('navigates from step 0 to step 1 with Next button', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await waitFor(() => {
      expect(screen.getByText('Select Template')).toBeInTheDocument();
    });
  });

  it('shows templates on step 1', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await waitFor(() => {
      expect(screen.getByText('Re-engagement')).toBeInTheDocument();
      expect(screen.getByText('Promo Offer')).toBeInTheDocument();
    });
  });

  it('shows empty template message when no templates', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/templates') return Promise.resolve([]);
      return Promise.resolve({});
    });

    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByTestId('campaign-filter-builder')).toBeInTheDocument();
    });

    // Need to enable Next - provide preview with count > 0
    mockApi.post.mockResolvedValue({ count: 10, samples: [] });

    await waitFor(() => {
      const nextBtn = screen.getByText('Next');
      expect(nextBtn).not.toBeDisabled();
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await waitFor(() => {
      expect(screen.getByText(/No templates found/)).toBeInTheDocument();
    });
  });

  it('navigates to schedule step after selecting template', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    // Go to step 1
    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    // Select a template
    await act(async () => {
      await user.click(screen.getByText('Re-engagement'));
    });

    // Go to step 2
    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await waitFor(() => {
      expect(screen.getByText('When to send')).toBeInTheDocument();
    });
  });

  // ─── Step 2: Schedule ───────────────────────────────────────

  it('renders schedule options with send now and later', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    // Navigate to step 2
    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await act(async () => {
      await user.click(screen.getByText('Re-engagement'));
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await waitFor(() => {
      expect(screen.getByText('Send immediately after creation')).toBeInTheDocument();
      expect(screen.getByText('Schedule for later')).toBeInTheDocument();
      expect(screen.getByText(/Throttle/)).toBeInTheDocument();
    });
  });

  // ─── Step 3: Review ─────────────────────────────────────────

  it('renders review step with summary', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    // Navigate through all steps
    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await waitFor(() => {
      expect(screen.getByText('Select Template')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Re-engagement'));
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await waitFor(() => {
      expect(screen.getByText('When to send')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await waitFor(() => {
      expect(screen.getByText('Campaign Name')).toBeInTheDocument();
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('Create Campaign')).toBeInTheDocument();
    });
  });

  it('submits campaign on review step', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    // Navigate through all steps
    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await act(async () => {
      await user.click(screen.getByText('Re-engagement'));
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    // Fill in campaign name
    const nameInput = screen.getByPlaceholderText('e.g. February Re-engagement');
    await act(async () => {
      await user.type(nameInput, 'My Campaign');
    });

    // Click Create Campaign
    await act(async () => {
      await user.click(screen.getByText('Create Campaign'));
    });

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/campaigns',
        expect.objectContaining({
          name: 'My Campaign',
          templateId: 't1',
        }),
      );
    });

    expect(mockPush).toHaveBeenCalledWith('/campaigns/new-campaign-id');
  });

  it('disables Create Campaign when name is empty', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    // Navigate to review step
    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await act(async () => {
      await user.click(screen.getByText('Re-engagement'));
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await waitFor(() => {
      expect(screen.getByText('Create Campaign')).toBeDisabled();
    });
  });

  // ─── Back Navigation ───────────────────────────────────────

  it('navigates back to previous step with Back button', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    // Go to step 1
    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    expect(screen.getByText('Select Template')).toBeInTheDocument();

    // Go back
    await act(async () => {
      await user.click(screen.getByText('Back'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('campaign-filter-builder')).toBeInTheDocument();
    });
  });

  it('shows Cancel on step 0 and navigates to campaigns', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Cancel'));
    });

    expect(mockPush).toHaveBeenCalledWith('/campaigns');
  });

  // ─── P-15: A/B Test UI ───────────────────────────────────────

  it('renders A/B Test toggle on message step', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await waitFor(() => {
      expect(screen.getByText('A/B Test')).toBeInTheDocument();
      expect(screen.getByTestId('ab-test-toggle')).toBeInTheDocument();
    });
  });

  it('shows variant tabs when A/B toggle is enabled', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await act(async () => {
      await user.click(screen.getByTestId('ab-test-toggle'));
    });

    await waitFor(() => {
      expect(screen.getByText('Variant A')).toBeInTheDocument();
      expect(screen.getByText('Variant B')).toBeInTheDocument();
      expect(screen.getByTestId('variant-content')).toBeInTheDocument();
      expect(screen.getByTestId('variant-percentage')).toBeInTheDocument();
    });
  });

  it('hides template list when A/B test is enabled', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    // Templates visible before toggle
    expect(screen.getByText('Select Template')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByTestId('ab-test-toggle'));
    });

    // Templates hidden after toggle
    expect(screen.queryByText('Select Template')).not.toBeInTheDocument();
  });

  it('shows percentage error when sum is not 100', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await act(async () => {
      await user.click(screen.getByTestId('ab-test-toggle'));
    });

    // Change percentage to create invalid sum
    const pctInput = screen.getByTestId('variant-percentage');
    await act(async () => {
      await user.clear(pctInput);
      await user.type(pctInput, '30');
    });

    await waitFor(() => {
      expect(screen.getByTestId('percentage-error')).toBeInTheDocument();
    });
  });

  it('can add a third variant', async () => {
    const user = userEvent.setup();

    render(<NewCampaignPage />);

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Next'));
    });

    await act(async () => {
      await user.click(screen.getByTestId('ab-test-toggle'));
    });

    await act(async () => {
      await user.click(screen.getByTestId('add-variant-btn'));
    });

    await waitFor(() => {
      expect(screen.getByText('Variant C')).toBeInTheDocument();
    });
  });
});

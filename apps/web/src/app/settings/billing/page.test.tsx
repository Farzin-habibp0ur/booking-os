import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BillingPage from './page';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
  I18nProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
    customerFields: [],
  }),
}));
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));

jest.mock('lucide-react', () => ({
  CreditCard: () => <span data-testid="credit-card-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
  Check: () => <span data-testid="check-icon" />,
  ExternalLink: () => <span data-testid="external-link-icon" />,
  ArrowLeft: () => <span data-testid="arrow-left-icon" />,
  Sparkles: () => <span data-testid="sparkles-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const NO_SUB_BILLING = {
  plan: 'starter',
  status: 'none',
  isTrial: false,
  trialDaysRemaining: 0,
  trialEndsAt: null,
  isGracePeriod: false,
  graceEndsAt: null,
  subscription: null,
};

const ACTIVE_SUB_BILLING = {
  plan: 'professional',
  status: 'active',
  isTrial: false,
  trialDaysRemaining: 0,
  trialEndsAt: null,
  isGracePeriod: false,
  graceEndsAt: null,
  subscription: {
    id: 'sub1',
    plan: 'professional',
    status: 'active',
    currentPeriodEnd: '2026-04-15T00:00:00Z',
    canceledAt: null,
  },
};

describe('BillingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders billing title', async () => {
    mockApi.get.mockResolvedValue(NO_SUB_BILLING);

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('billing.title')).toBeInTheDocument();
    });
  });

  test('shows three plan cards when no subscription', async () => {
    mockApi.get.mockResolvedValue(NO_SUB_BILLING);

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });
  });

  test('shows three subscribe buttons when no subscription', async () => {
    mockApi.get.mockResolvedValue(NO_SUB_BILLING);

    render(<BillingPage />);

    await waitFor(() => {
      const buttons = screen.getAllByText('Subscribe');
      expect(buttons).toHaveLength(3);
    });
  });

  test('shows monthly/annual toggle', async () => {
    mockApi.get.mockResolvedValue(NO_SUB_BILLING);

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Monthly')).toBeInTheDocument();
      expect(screen.getByText('Annual')).toBeInTheDocument();
    });
  });

  test('calls checkout API with plan and billing interval', async () => {
    mockApi.get.mockResolvedValue(NO_SUB_BILLING);
    mockApi.post.mockResolvedValue({ url: 'https://checkout.stripe.com/test' });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Subscribe')).toHaveLength(3);
    });

    const buttons = screen.getAllByText('Subscribe');
    await userEvent.click(buttons[0]);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/billing/checkout', {
        plan: 'starter',
        billing: 'monthly',
      });
    });

    expect(window.location.href).toBe('https://checkout.stripe.com/test');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  test('shows current plan when subscription exists', async () => {
    mockApi.get.mockResolvedValue(ACTIVE_SUB_BILLING);

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Professional Plan')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  test('shows manage billing button for active subscription', async () => {
    mockApi.get.mockResolvedValue(ACTIVE_SUB_BILLING);

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('billing.manage_billing')).toBeInTheDocument();
    });
  });

  test('marks current plan with "Current Plan" label', async () => {
    mockApi.get.mockResolvedValue(ACTIVE_SUB_BILLING);

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Current Plan')).toBeInTheDocument();
    });
  });

  test('shows warning banner for past_due', async () => {
    mockApi.get.mockResolvedValue({
      ...ACTIVE_SUB_BILLING,
      subscription: { ...ACTIVE_SUB_BILLING.subscription, status: 'past_due' },
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('warning-banner')).toBeInTheDocument();
      expect(screen.getByText('billing.past_due_warning')).toBeInTheDocument();
    });
  });

  test('shows warning banner for canceled', async () => {
    mockApi.get.mockResolvedValue({
      ...ACTIVE_SUB_BILLING,
      subscription: { ...ACTIVE_SUB_BILLING.subscription, status: 'canceled' },
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('warning-banner')).toBeInTheDocument();
      expect(screen.getByText('billing.canceled_warning')).toBeInTheDocument();
    });
  });

  test('shows trial info banner during trial', async () => {
    mockApi.get.mockResolvedValue({
      ...NO_SUB_BILLING,
      isTrial: true,
      trialDaysRemaining: 10,
      trialEndsAt: '2026-03-18T00:00:00Z',
      status: 'trialing',
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText(/10 days left/)).toBeInTheDocument();
    });
  });

  test('shows grace period warning', async () => {
    mockApi.get.mockResolvedValue({
      ...NO_SUB_BILLING,
      isGracePeriod: true,
      status: 'expired',
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText(/trial has ended/)).toBeInTheDocument();
    });
  });

  // M11 fix: Stripe redirect URL validation
  test('rejects non-Stripe checkout URL and shows error', async () => {
    mockApi.get.mockResolvedValue(NO_SUB_BILLING);
    mockApi.post.mockResolvedValue({ url: 'https://evil.com/phish' });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Subscribe')).toHaveLength(3);
    });

    await userEvent.click(screen.getAllByText('Subscribe')[0]);

    await waitFor(() => {
      expect(screen.getByText('billing.checkout_error')).toBeInTheDocument();
    });

    // Should NOT redirect
    expect(window.location.href).toBe('');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  test('rejects non-Stripe portal URL and shows error', async () => {
    mockApi.get.mockResolvedValue(ACTIVE_SUB_BILLING);
    mockApi.post.mockResolvedValue({ url: 'http://not-stripe.com/portal' });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('billing.manage_billing')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('billing.manage_billing'));

    await waitFor(() => {
      expect(screen.getByText('billing.portal_error')).toBeInTheDocument();
    });

    expect(window.location.href).toBe('');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  test('calls portal API on manage billing click', async () => {
    mockApi.get.mockResolvedValue(ACTIVE_SUB_BILLING);
    mockApi.post.mockResolvedValue({ url: 'https://billing.stripe.com/portal' });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('billing.manage_billing')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('billing.manage_billing'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/billing/portal');
    });

    expect(window.location.href).toBe('https://billing.stripe.com/portal');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });
});

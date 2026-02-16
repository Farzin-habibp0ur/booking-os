import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BillingPage from './page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>);
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: '1', name: 'Sarah', role: 'OWNER', businessId: 'b1' }, loading: false }),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
  I18nProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({ name: 'general', labels: { customer: 'Customer', booking: 'Booking', service: 'Service' }, customerFields: [] }),
}));
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

describe('BillingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders billing title', async () => {
    mockApi.get.mockResolvedValue(null);

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('billing.title')).toBeInTheDocument();
    });
  });

  test('shows plan cards when no subscription', async () => {
    mockApi.get.mockResolvedValue(null);

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('billing.basic_plan')).toBeInTheDocument();
      expect(screen.getByText('billing.pro_plan')).toBeInTheDocument();
    });
  });

  test('shows two subscribe buttons when no subscription', async () => {
    mockApi.get.mockResolvedValue(null);

    render(<BillingPage />);

    await waitFor(() => {
      const buttons = screen.getAllByText('billing.subscribe');
      expect(buttons).toHaveLength(2);
    });
  });

  test('calls checkout API and redirects on subscribe click', async () => {
    mockApi.get.mockResolvedValue(null);
    mockApi.post.mockResolvedValue({ url: 'https://checkout.stripe.com/test' });

    // Mock window.location.href
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getAllByText('billing.subscribe')).toHaveLength(2);
    });

    const buttons = screen.getAllByText('billing.subscribe');
    await userEvent.click(buttons[0]);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/billing/checkout', { plan: 'basic' });
    });

    expect(window.location.href).toBe('https://checkout.stripe.com/test');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  test('shows current plan when subscription exists', async () => {
    mockApi.get.mockResolvedValue({
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: '2026-03-15T00:00:00Z',
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('billing.pro_plan')).toBeInTheDocument();
      expect(screen.getByText('billing.status_active')).toBeInTheDocument();
    });
  });

  test('shows change plan and manage billing buttons', async () => {
    mockApi.get.mockResolvedValue({
      plan: 'basic',
      status: 'active',
      currentPeriodEnd: '2026-03-15T00:00:00Z',
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('billing.change_plan')).toBeInTheDocument();
      expect(screen.getByText('billing.manage_billing')).toBeInTheDocument();
    });
  });

  test('shows warning banner for past_due', async () => {
    mockApi.get.mockResolvedValue({
      plan: 'pro',
      status: 'past_due',
      currentPeriodEnd: '2026-03-15T00:00:00Z',
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('warning-banner')).toBeInTheDocument();
      expect(screen.getByText('billing.past_due_warning')).toBeInTheDocument();
    });
  });

  test('shows warning banner for canceled', async () => {
    mockApi.get.mockResolvedValue({
      plan: 'basic',
      status: 'canceled',
      currentPeriodEnd: '2026-03-15T00:00:00Z',
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('warning-banner')).toBeInTheDocument();
      expect(screen.getByText('billing.canceled_warning')).toBeInTheDocument();
    });
  });

  test('calls portal API on manage billing click', async () => {
    mockApi.get.mockResolvedValue({
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: '2026-03-15T00:00:00Z',
    });
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

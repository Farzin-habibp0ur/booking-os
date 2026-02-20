import { render, screen, waitFor } from '@testing-library/react';
import ConsoleBillingPage from './page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>{children}</a>
));

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Admin', role: 'SUPER_ADMIN', businessId: 'b1' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  I18nProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({ name: 'general', labels: {}, customerFields: [] }),
  VerticalPackProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
  ToastProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() },
}));

jest.mock('@/components/skeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton">Loading...</div>,
}));

jest.mock('lucide-react', () => ({
  TrendingUp: (props: any) => <div {...props} />,
  AlertTriangle: (props: any) => <div {...props} />,
  Users: (props: any) => <div {...props} />,
  DollarSign: (props: any) => <div {...props} />,
  ArrowRight: (props: any) => <div {...props} />,
  CreditCard: (props: any) => <div {...props} />,
  Percent: (props: any) => <div {...props} />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const dashboardData = {
  mrr: 692,
  activeCount: 8,
  trialCount: 2,
  pastDueCount: 1,
  canceledCount: 3,
  churnRate: 0.03,
  arpa: 86.5,
  trialToPaidRate: 0.6,
  planDistribution: { basic: 5, pro: 3 },
  totalRevenue30d: 692,
};

describe('ConsoleBillingPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows loading state', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));
    render(<ConsoleBillingPage />);
    expect(screen.getByTestId('billing-loading')).toBeInTheDocument();
  });

  it('renders KPI cards with formatted values', async () => {
    mockApi.get.mockResolvedValue(dashboardData);
    render(<ConsoleBillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('mrr-value')).toHaveTextContent('$692');
      expect(screen.getByTestId('active-count')).toHaveTextContent('8');
      expect(screen.getByTestId('churn-rate')).toHaveTextContent('3.0%');
      expect(screen.getByTestId('trial-to-paid')).toHaveTextContent('60.0%');
    });
  });

  it('shows past-due alert when count > 0', async () => {
    mockApi.get.mockResolvedValue(dashboardData);
    render(<ConsoleBillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('past-due-alert')).toBeInTheDocument();
      expect(screen.getByTestId('past-due-badge')).toHaveTextContent('1');
    });
  });

  it('does not show past-due alert when count is 0', async () => {
    mockApi.get.mockResolvedValue({ ...dashboardData, pastDueCount: 0 });
    render(<ConsoleBillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('kpi-cards')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('past-due-alert')).not.toBeInTheDocument();
  });

  it('shows plan distribution', async () => {
    mockApi.get.mockResolvedValue(dashboardData);
    render(<ConsoleBillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('plan-distribution')).toBeInTheDocument();
      expect(screen.getByTestId('basic-count')).toHaveTextContent('5');
      expect(screen.getByTestId('pro-count')).toHaveTextContent('3');
    });
  });

  it('shows error state', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));
    render(<ConsoleBillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('billing-error')).toHaveTextContent('Network error');
    });
  });

  it('links to past-due and subscriptions pages', async () => {
    mockApi.get.mockResolvedValue(dashboardData);
    render(<ConsoleBillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('past-due-link')).toHaveAttribute('href', '/console/billing/past-due');
      expect(screen.getByTestId('subscriptions-link')).toHaveAttribute('href', '/console/billing/subscriptions');
    });
  });

  it('handles zero MRR and zero subscriptions', async () => {
    mockApi.get.mockResolvedValue({
      ...dashboardData,
      mrr: 0,
      activeCount: 0,
      trialCount: 0,
      pastDueCount: 0,
      canceledCount: 0,
      churnRate: 0,
      arpa: 0,
      trialToPaidRate: 0,
      planDistribution: { basic: 0, pro: 0 },
    });
    render(<ConsoleBillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('mrr-value')).toHaveTextContent('$0');
      expect(screen.getByTestId('active-count')).toHaveTextContent('0');
    });
  });
});

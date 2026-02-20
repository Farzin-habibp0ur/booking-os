import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubscriptionsPage from './page';

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

jest.mock('lucide-react', () => ({
  Search: (props: any) => <div {...props} />,
  ChevronLeft: (props: any) => <div {...props} />,
  ChevronRight: (props: any) => <div {...props} />,
  CreditCard: (props: any) => <div {...props} />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const subscriptionsList = {
  items: [
    {
      id: 'sub1',
      businessId: 'biz1',
      businessName: 'Glow Clinic',
      businessSlug: 'glow-clinic',
      ownerEmail: 'admin@glow.com',
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: '2026-03-15T00:00:00Z',
      createdAt: '2025-12-01T00:00:00Z',
    },
    {
      id: 'sub2',
      businessId: 'biz2',
      businessName: 'Zen Spa',
      businessSlug: 'zen-spa',
      ownerEmail: 'admin@zen.com',
      plan: 'basic',
      status: 'trialing',
      currentPeriodEnd: '2026-03-20T00:00:00Z',
      createdAt: '2026-02-01T00:00:00Z',
    },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
};

describe('SubscriptionsPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows loading state', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));
    render(<SubscriptionsPage />);
    expect(screen.getByTestId('subscriptions-loading')).toBeInTheDocument();
  });

  it('renders subscriptions table', async () => {
    mockApi.get.mockResolvedValue(subscriptionsList);
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('subscriptions-table')).toBeInTheDocument();
      expect(screen.getByText('Glow Clinic')).toBeInTheDocument();
      expect(screen.getByText('Zen Spa')).toBeInTheDocument();
    });
  });

  it('search input is present', async () => {
    mockApi.get.mockResolvedValue(subscriptionsList);
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });
  });

  it('plan filter changes trigger re-fetch', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue(subscriptionsList);
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('plan-filter')).toBeInTheDocument();
    });

    await act(async () => {
      await user.selectOptions(screen.getByTestId('plan-filter'), 'pro');
    });

    await waitFor(() => {
      const calls = mockApi.get.mock.calls;
      const lastCall = calls[calls.length - 1][0] as string;
      expect(lastCall).toContain('plan=pro');
    });
  });

  it('status filter changes trigger re-fetch', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue(subscriptionsList);
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('status-filter')).toBeInTheDocument();
    });

    await act(async () => {
      await user.selectOptions(screen.getByTestId('status-filter'), 'past_due');
    });

    await waitFor(() => {
      const calls = mockApi.get.mock.calls;
      const lastCall = calls[calls.length - 1][0] as string;
      expect(lastCall).toContain('status=past_due');
    });
  });

  it('navigates to Business 360 on row click', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue(subscriptionsList);
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('sub-row-sub1')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('sub-row-sub1'));
    });

    expect(mockPush).toHaveBeenCalledWith('/console/businesses/biz1');
  });

  it('shows empty state when no results', async () => {
    mockApi.get.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('subscriptions-empty')).toBeInTheDocument();
      expect(screen.getByText('No subscriptions found')).toBeInTheDocument();
    });
  });

  it('shows error state', async () => {
    mockApi.get.mockRejectedValue(new Error('Server error'));
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('subscriptions-error')).toHaveTextContent('Server error');
    });
  });

  it('shows pagination when multiple pages exist', async () => {
    mockApi.get.mockResolvedValue({
      items: subscriptionsList.items,
      total: 45,
      page: 1,
      pageSize: 20,
    });
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });
  });
});

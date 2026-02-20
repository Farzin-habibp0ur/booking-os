import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PastDuePage from './page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
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
  ChevronRight: (props: any) => <div {...props} />,
  CheckCircle: (props: any) => <div {...props} />,
  AlertTriangle: (props: any) => <div {...props} />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const pastDueItems = [
  {
    id: 'sub1',
    businessId: 'biz1',
    businessName: 'Slow Payer Clinic',
    ownerEmail: 'owner@slow.com',
    plan: 'pro',
    currentPeriodEnd: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    daysPastDue: 20,
  },
  {
    id: 'sub2',
    businessId: 'biz2',
    businessName: 'Recent Clinic',
    ownerEmail: 'owner@recent.com',
    plan: 'basic',
    currentPeriodEnd: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    daysPastDue: 3,
  },
];

describe('PastDuePage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows loading state', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));
    render(<PastDuePage />);
    expect(screen.getByTestId('past-due-loading')).toBeInTheDocument();
  });

  it('renders past-due table with items', async () => {
    mockApi.get.mockResolvedValue(pastDueItems);
    render(<PastDuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('past-due-table')).toBeInTheDocument();
      expect(screen.getByText('Slow Payer Clinic')).toBeInTheDocument();
      expect(screen.getByText('Recent Clinic')).toBeInTheDocument();
    });
  });

  it('color codes by days past due', async () => {
    mockApi.get.mockResolvedValue(pastDueItems);
    render(<PastDuePage />);

    await waitFor(() => {
      const badge20 = screen.getByTestId('days-badge-biz1');
      expect(badge20).toHaveTextContent('20d');
      // 20 days = red
      expect(badge20.className).toContain('text-red-600');

      const badge3 = screen.getByTestId('days-badge-biz2');
      expect(badge3).toHaveTextContent('3d');
      // 3 days = amber
      expect(badge3.className).toContain('text-amber-600');
    });
  });

  it('shows empty state with green checkmark', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<PastDuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('past-due-empty')).toBeInTheDocument();
      expect(screen.getByText('No past-due accounts')).toBeInTheDocument();
    });
  });

  it('navigates to Business 360 on row click', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue(pastDueItems);
    render(<PastDuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('past-due-row-biz1')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByTestId('past-due-row-biz1'));
    });

    expect(mockPush).toHaveBeenCalledWith('/console/businesses/biz1');
  });

  it('shows error state', async () => {
    mockApi.get.mockRejectedValue(new Error('Failed'));
    render(<PastDuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('past-due-error')).toHaveTextContent('Failed');
    });
  });
});

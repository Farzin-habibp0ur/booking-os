const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'cust-1' }),
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
  VerticalPackProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
  ToastProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;
jest.mock('@/components/skeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
  TableRowSkeleton: () => <tr data-testid="table-skeleton"><td /></tr>,
  EmptyState: ({ title }: any) => <div data-testid="empty-state">{title}</div>,
}));
jest.mock('@/components/booking-form-modal', () => ({ __esModule: true, default: () => <div data-testid="booking-form-modal" /> }));

import { render, screen, waitFor } from '@testing-library/react';
import CustomerDetailPage from './page';

describe('CustomerDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', async () => {
    mockApi.get.mockImplementation(() => {
      return new Promise(() => {}); // Never resolves
    });

    render(<CustomerDetailPage />);

    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('renders customer details after loading', async () => {
    mockApi.get.mockImplementation((path) => {
      if (path === '/customers/cust-1') {
        return Promise.resolve({
          id: 'cust-1',
          name: 'Emma Wilson',
          phone: '+1234',
          email: 'emma@test.com',
          tags: ['VIP'],
          createdAt: '2026-01-01',
          customFields: {},
        });
      }
      if (path === '/customers/cust-1/bookings') {
        return Promise.resolve([]);
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Emma Wilson').length).toBeGreaterThan(0);
    });
  });

  it('shows contact information', async () => {
    mockApi.get.mockImplementation((path) => {
      if (path === '/customers/cust-1') {
        return Promise.resolve({
          id: 'cust-1',
          name: 'Emma Wilson',
          phone: '+1234',
          email: 'emma@test.com',
          tags: ['VIP'],
          createdAt: '2026-01-01',
          customFields: {},
        });
      }
      if (path === '/customers/cust-1/bookings') {
        return Promise.resolve([]);
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('+1234')).toBeInTheDocument();
      expect(screen.getByText('emma@test.com')).toBeInTheDocument();
    });
  });

  it('shows customer tags', async () => {
    mockApi.get.mockImplementation((path) => {
      if (path === '/customers/cust-1') {
        return Promise.resolve({
          id: 'cust-1',
          name: 'Emma Wilson',
          phone: '+1234',
          email: 'emma@test.com',
          tags: ['VIP'],
          createdAt: '2026-01-01',
          customFields: {},
        });
      }
      if (path === '/customers/cust-1/bookings') {
        return Promise.resolve([]);
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CustomerDetailPage />);

    await waitFor(() => {
      const vipTags = screen.getAllByText('VIP');
      expect(vipTags.length).toBeGreaterThan(0);
    });
  });

  it('shows booking stats', async () => {
    mockApi.get.mockImplementation((path) => {
      if (path === '/customers/cust-1') {
        return Promise.resolve({
          id: 'cust-1',
          name: 'Emma Wilson',
          phone: '+1234',
          email: 'emma@test.com',
          tags: ['VIP'],
          createdAt: '2026-01-01',
          customFields: {},
        });
      }
      if (path === '/customers/cust-1/bookings') {
        return Promise.resolve([
          {
            id: 'b1',
            startTime: '2026-03-01T10:00:00Z',
            status: 'COMPLETED',
            service: { name: 'Haircut', price: 50 },
            staff: { name: 'John' },
          },
          {
            id: 'b2',
            startTime: '2026-04-01T10:00:00Z',
            status: 'CONFIRMED',
            service: { name: 'Coloring', price: 100 },
            staff: { name: 'Jane' },
          },
        ]);
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CustomerDetailPage />);

    await waitFor(() => {
      // Should show total count of 2 bookings
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows not found when customer does not exist', async () => {
    mockApi.get.mockImplementation(() => {
      return Promise.reject(new Error('Not found'));
    });

    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('errors.not_found')).toBeInTheDocument();
    });
  });
});

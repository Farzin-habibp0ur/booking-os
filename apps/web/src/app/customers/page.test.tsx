const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'cust-1' }),
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
  TableRowSkeleton: () => (
    <tr data-testid="table-skeleton">
      <td />
    </tr>
  ),
  EmptyState: ({ title }: any) => <div data-testid="empty-state">{title}</div>,
}));

import { render, screen, waitFor } from '@testing-library/react';
import CustomersPage from './page';

describe('CustomersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders customers page with title', async () => {
    mockApi.get.mockImplementation((path) => {
      if (path === '/customers?search=&pageSize=50') {
        return Promise.resolve({ data: [], total: 0 });
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText('customers.title')).toBeInTheDocument();
    });
  });

  it('displays customers in table', async () => {
    mockApi.get.mockImplementation((path) => {
      if (path === '/customers?search=&pageSize=50') {
        return Promise.resolve({
          data: [
            {
              id: '1',
              name: 'Emma',
              phone: '+1234',
              email: 'emma@test.com',
              tags: ['VIP'],
              createdAt: '2026-01-01',
            },
          ],
          total: 1,
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText('Emma')).toBeInTheDocument();
    });
    expect(screen.getByText('+1234')).toBeInTheDocument();
    expect(screen.getByText('emma@test.com')).toBeInTheDocument();
    expect(screen.getByText('VIP')).toBeInTheDocument();
  });

  it('shows empty state when no customers', async () => {
    mockApi.get.mockImplementation((path) => {
      if (path === '/customers?search=&pageSize=50') {
        return Promise.resolve({ data: [], total: 0 });
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('has search input', async () => {
    mockApi.get.mockImplementation((path) => {
      if (path === '/customers?search=&pageSize=50') {
        return Promise.resolve({ data: [], total: 0 });
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CustomersPage />);

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('customers.search_placeholder');
      expect(searchInput).toBeInTheDocument();
    });
  });

  it('has add customer and import buttons', async () => {
    mockApi.get.mockImplementation((path) => {
      if (path === '/customers?search=&pageSize=50') {
        return Promise.resolve({ data: [], total: 0 });
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText('customers.add_button')).toBeInTheDocument();
      expect(screen.getByText('import.import_button')).toBeInTheDocument();
    });
  });
});

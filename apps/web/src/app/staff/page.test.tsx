import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffPage from './page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: 'OWNER', businessId: 'b1' },
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
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

describe('StaffPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders staff page with title', async () => {
    mockApi.get.mockResolvedValue([]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('staff.title')).toBeInTheDocument();
    });
  });

  test('displays staff in table', async () => {
    mockApi.get.mockResolvedValue([
      {
        id: '1',
        name: 'Sarah',
        email: 'sarah@test.com',
        role: 'OWNER',
        isActive: true,
      },
    ]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah')).toBeInTheDocument();
      expect(screen.getByText('OWNER')).toBeInTheDocument();
    });
  });

  test('has invite staff button', async () => {
    mockApi.get.mockResolvedValue([]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('staff.add_button')).toBeInTheDocument();
    });
  });

  test('shows active/inactive status', async () => {
    mockApi.get.mockResolvedValue([
      {
        id: '1',
        name: 'Sarah',
        email: 'sarah@test.com',
        role: 'OWNER',
        isActive: true,
      },
    ]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('common.active')).toBeInTheDocument();
    });
  });
});

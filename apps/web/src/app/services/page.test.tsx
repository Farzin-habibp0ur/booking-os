import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServicesPage from './page';

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
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

describe('ServicesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders services page with title', async () => {
    mockApi.get.mockResolvedValue([]);

    render(<ServicesPage />);

    await waitFor(() => {
      expect(screen.getByText('services.title')).toBeInTheDocument();
    });
  });

  test('displays service cards', async () => {
    mockApi.get.mockResolvedValue([
      {
        id: '1',
        name: 'Haircut',
        durationMins: 30,
        price: 50,
        category: 'Hair',
        isActive: true,
      },
    ]);

    render(<ServicesPage />);

    await waitFor(() => {
      expect(screen.getByText('Haircut')).toBeInTheDocument();
      expect(screen.getByText(/50/)).toBeInTheDocument();
      expect(screen.getByText(/30/)).toBeInTheDocument();
    });
  });

  test('shows empty state when no services', async () => {
    mockApi.get.mockResolvedValue([]);

    render(<ServicesPage />);

    await waitFor(() => {
      expect(screen.getByText('services.no_services')).toBeInTheDocument();
    });
  });

  test('has add service button', async () => {
    mockApi.get.mockResolvedValue([]);

    render(<ServicesPage />);

    await waitFor(() => {
      expect(screen.getByText('services.add_button')).toBeInTheDocument();
    });
  });

  test('shows inactive badge on deactivated services when show inactive is checked', async () => {
    mockApi.get.mockResolvedValue([
      {
        id: '1',
        name: 'Haircut',
        durationMins: 30,
        price: 50,
        category: 'Hair',
        isActive: false,
      },
    ]);

    render(<ServicesPage />);

    // Inactive services are hidden by default; click checkbox to show them
    const showInactiveCheckbox = screen.getByRole('checkbox');
    await userEvent.click(showInactiveCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Haircut')).toBeInTheDocument();
      expect(screen.getByText('services.inactive_badge')).toBeInTheDocument();
    });
  });
});

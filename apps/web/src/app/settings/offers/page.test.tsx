import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OffersSettingsPage from './page';

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

jest.mock('lucide-react', () => ({
  ArrowLeft: (p: any) => <span data-testid="icon-arrow-left" {...p} />,
  Plus: (p: any) => <span data-testid="icon-plus" {...p} />,
  Trash2: (p: any) => <span data-testid="icon-trash" {...p} />,
  Tag: (p: any) => <span data-testid="icon-tag" {...p} />,
}));

const mockOffers = [
  { id: 'o1', name: 'Summer Sale', description: '20% off', isActive: true, validUntil: null },
  { id: 'o2', name: 'New Client', description: 'Free consult', isActive: false, validUntil: null },
];

describe('OffersSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows loading then renders Offers title', async () => {
    mockApi.get.mockResolvedValue(mockOffers);
    render(<OffersSettingsPage />);

    // Loading state shown first
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Offers')).toBeInTheDocument();
    });
  });

  test('shows empty state when no offers', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<OffersSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText('No offers yet. Create one to include in campaigns.'),
      ).toBeInTheDocument();
    });
  });

  test('opens create form on New Offer click', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<OffersSettingsPage />);
    await waitFor(() => screen.getByText('Offers'));

    fireEvent.click(screen.getByText('New Offer'));

    expect(screen.getByPlaceholderText('Offer name')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  test('displays offer cards with name and status badge', async () => {
    mockApi.get.mockResolvedValue(mockOffers);
    render(<OffersSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Summer Sale')).toBeInTheDocument();
      expect(screen.getByText('New Client')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  test('calls API to toggle offer active state', async () => {
    mockApi.get.mockResolvedValue(mockOffers);
    mockApi.patch.mockResolvedValue({});
    render(<OffersSettingsPage />);

    await waitFor(() => screen.getByText('Summer Sale'));

    // The first offer is active, so button says "Deactivate"
    fireEvent.click(screen.getByText('Deactivate'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/offers/o1', { isActive: false });
    });
  });
});

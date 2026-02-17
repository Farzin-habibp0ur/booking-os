import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

const mockServices = [
  {
    id: 's1',
    name: 'Botox',
    durationMins: 30,
    price: 200,
    category: 'Injectables',
    isActive: true,
    kind: 'TREATMENT',
    depositRequired: true,
    description: 'Anti-wrinkle treatment',
    bufferBefore: 5,
    bufferAfter: 10,
  },
  {
    id: 's2',
    name: 'Consultation',
    durationMins: 15,
    price: 0,
    category: 'Injectables',
    isActive: true,
    kind: 'CONSULT',
    depositRequired: false,
    description: '',
    bufferBefore: 0,
    bufferAfter: 0,
  },
  {
    id: 's3',
    name: 'Laser Removal',
    durationMins: 60,
    price: 500,
    category: 'Laser',
    isActive: false,
    kind: 'OTHER',
    depositRequired: false,
    bufferBefore: 0,
    bufferAfter: 0,
  },
];

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

  test('displays service cards grouped by category', async () => {
    mockApi.get.mockResolvedValue(mockServices);
    render(<ServicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Botox')).toBeInTheDocument();
      expect(screen.getByText('Consultation')).toBeInTheDocument();
      expect(screen.getByText('Injectables')).toBeInTheDocument();
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

  test('hides inactive services by default', async () => {
    mockApi.get.mockResolvedValue(mockServices);
    render(<ServicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Botox')).toBeInTheDocument();
    });
    // Laser category should not show since its only service is inactive
    expect(screen.queryByText('Laser Removal')).not.toBeInTheDocument();
  });

  test('shows inactive services when checkbox is toggled', async () => {
    mockApi.get.mockResolvedValue(mockServices);
    render(<ServicesPage />);
    await waitFor(() => screen.getByText('Botox'));

    const showInactiveCheckbox = screen.getByRole('checkbox');
    await userEvent.click(showInactiveCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Laser Removal')).toBeInTheDocument();
      expect(screen.getByText('services.inactive_badge')).toBeInTheDocument();
    });
  });

  test('shows service type badges (Consult, Treatment)', async () => {
    mockApi.get.mockResolvedValue(mockServices);
    render(<ServicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Treatment')).toBeInTheDocument();
      expect(screen.getByText('Consult')).toBeInTheDocument();
    });
  });

  test('shows deposit badge on deposit-required services', async () => {
    mockApi.get.mockResolvedValue(mockServices);
    render(<ServicesPage />);
    await waitFor(() => {
      expect(screen.getByText('services.deposit_badge')).toBeInTheDocument();
    });
  });

  test('shows service description', async () => {
    mockApi.get.mockResolvedValue(mockServices);
    render(<ServicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Anti-wrinkle treatment')).toBeInTheDocument();
    });
  });

  test('shows buffer times when set', async () => {
    mockApi.get.mockResolvedValue(mockServices);
    render(<ServicesPage />);
    await waitFor(() => {
      expect(screen.getByText('services.buffer_before')).toBeInTheDocument();
      expect(screen.getByText('services.buffer_after')).toBeInTheDocument();
    });
  });

  test('shows free price label for $0 services', async () => {
    mockApi.get.mockResolvedValue(mockServices);
    render(<ServicesPage />);
    await waitFor(() => {
      expect(screen.getByText('services.price_free')).toBeInTheDocument();
    });
  });

  // ─── Service Form ─────────────────────────────────────────────────────

  test('opens add form when add button is clicked', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<ServicesPage />);
    await waitFor(() => screen.getByText('services.add_button'));

    fireEvent.click(screen.getByText('services.add_button'));

    await waitFor(() => {
      expect(screen.getByText('services.form_title_add')).toBeInTheDocument();
    });
  });

  test('opens edit form when pencil is clicked', async () => {
    mockApi.get.mockResolvedValue(mockServices);
    render(<ServicesPage />);
    await waitFor(() => screen.getByText('Botox'));

    // Click the edit pencil on the first service card
    const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg'));
    // The pencil buttons are within service cards
    const pencilBtn = screen.getByText('Botox').closest('.bg-white')?.querySelector('button');
    if (pencilBtn) fireEvent.click(pencilBtn);

    await waitFor(() => {
      expect(screen.getByText('services.form_title_edit')).toBeInTheDocument();
    });
  });

  test('creates new service via form', async () => {
    mockApi.get.mockResolvedValue([]);
    mockApi.post.mockResolvedValue({});
    render(<ServicesPage />);
    await waitFor(() => screen.getByText('services.add_button'));

    fireEvent.click(screen.getByText('services.add_button'));

    await waitFor(() => screen.getByText('services.form_title_add'));

    // Fill in name
    const nameInput = screen.getByPlaceholderText('services.name_placeholder');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'New Service');

    // Submit
    fireEvent.click(screen.getByText('common.create'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/services',
        expect.objectContaining({
          name: 'New Service',
        }),
      );
    });
  });

  test('closes form on cancel', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<ServicesPage />);
    await waitFor(() => screen.getByText('services.add_button'));

    fireEvent.click(screen.getByText('services.add_button'));
    await waitFor(() => screen.getByText('services.form_title_add'));

    fireEvent.click(screen.getByText('common.cancel'));

    await waitFor(() => {
      expect(screen.queryByText('services.form_title_add')).not.toBeInTheDocument();
    });
  });

  test('shows deactivate button when editing active service', async () => {
    mockApi.get.mockResolvedValue(mockServices);
    render(<ServicesPage />);
    await waitFor(() => screen.getByText('Botox'));

    const pencilBtn = screen.getByText('Botox').closest('.bg-white')?.querySelector('button');
    if (pencilBtn) fireEvent.click(pencilBtn);

    await waitFor(() => {
      expect(screen.getByText('services.deactivate')).toBeInTheDocument();
    });
  });

  test('shows active count in subtitle', async () => {
    mockApi.get.mockResolvedValue(mockServices);
    render(<ServicesPage />);
    await waitFor(() => {
      expect(screen.getByText('services.active_count')).toBeInTheDocument();
    });
  });
});

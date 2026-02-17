import { render, screen, waitFor } from '@testing-library/react';
import TemplatesPage from './page';

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
  Plus: (p: any) => <span data-testid="icon-plus" {...p} />,
  Pencil: (p: any) => <span data-testid="icon-pencil" {...p} />,
  Trash2: (p: any) => <span data-testid="icon-trash" {...p} />,
  Eye: (p: any) => <span data-testid="icon-eye" {...p} />,
  X: (p: any) => <span data-testid="icon-x" {...p} />,
  FileText: (p: any) => <span data-testid="icon-file-text" {...p} />,
  AlertTriangle: (p: any) => <span data-testid="icon-alert" {...p} />,
}));

const mockTemplates = [
  {
    id: 't1',
    name: 'Booking Confirmation',
    category: 'CONFIRMATION',
    body: 'Hi {{customerName}}, your booking is confirmed for {{date}}.',
    variables: ['customerName', 'date'],
  },
  {
    id: 't2',
    name: 'Reminder',
    category: 'REMINDER',
    body: 'Reminder: your appointment is tomorrow at {{time}}.',
    variables: ['time'],
  },
];

describe('TemplatesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders title after load', async () => {
    mockApi.get.mockResolvedValue(mockTemplates);
    render(<TemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText('templates.title')).toBeInTheDocument();
    });
  });

  test('shows empty state when no templates', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<TemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText('templates.no_templates')).toBeInTheDocument();
    });
  });

  test('shows new template button', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<TemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText('templates.new_template')).toBeInTheDocument();
    });
  });

  test('displays template cards with name and body', async () => {
    mockApi.get.mockResolvedValue(mockTemplates);
    render(<TemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText('Booking Confirmation')).toBeInTheDocument();
      expect(
        screen.getByText('Hi {{customerName}}, your booking is confirmed for {{date}}.'),
      ).toBeInTheDocument();
      expect(screen.getByText('Reminder')).toBeInTheDocument();
      expect(
        screen.getByText('Reminder: your appointment is tomorrow at {{time}}.'),
      ).toBeInTheDocument();
    });
  });

  test('shows category filter buttons', async () => {
    mockApi.get.mockResolvedValue(mockTemplates);
    render(<TemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText('common.all')).toBeInTheDocument();
      expect(screen.getByText('templates.category_confirmation')).toBeInTheDocument();
      expect(screen.getByText('templates.category_reminder')).toBeInTheDocument();
      expect(screen.getByText('templates.category_custom')).toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffPage from './page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock auth
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Admin', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

// Mock i18n
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  I18nProvider: ({ children }: any) => children,
}));

// Mock toast
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
  ToastProvider: ({ children }: any) => children,
}));

// Mock cn
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock use-plan
jest.mock('@/lib/use-plan', () => ({
  usePlan: () => ({ name: 'pro', limits: {} }),
}));

// Mock api
const mockGet = jest.fn().mockResolvedValue([
  { id: 's1', name: 'Sarah Johnson', email: 'sarah@test.com', role: 'ADMIN', isActive: true },
  { id: 's2', name: 'Mike Brown', email: 'mike@test.com', role: 'AGENT', isActive: false },
]);
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Plus: () => <div data-testid="plus-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  ChevronRight: () => <div data-testid="chevron-right-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  CalendarOff: () => <div data-testid="calendar-off-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  DollarSign: () => <div data-testid="dollar-icon" />,
  Download: () => <div data-testid="download-icon" />,
  UserCog: () => <div data-testid="user-cog-icon" />,
}));

// Mock UpgradeNudge
jest.mock('@/components/upgrade-nudge', () => ({
  UpgradeNudge: () => null,
}));

// Mock ExportModal
jest.mock('@/components/export-modal', () => ({
  __esModule: true,
  default: ({ isOpen, onClose, entity }: any) =>
    isOpen ? (
      <div data-testid="export-modal">
        <span data-testid="export-entity">{entity}</span>
        <button data-testid="export-close" onClick={onClose}>
          Close Export
        </button>
      </div>
    ) : null,
}));

describe('StaffPage', () => {
  beforeEach(() => {
    mockGet.mockClear();
  });

  it('renders staff list', async () => {
    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      expect(screen.getByText('Mike Brown')).toBeInTheDocument();
    });
  });

  it('renders Export CSV button', async () => {
    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });
  });

  it('opens export modal when Export CSV is clicked', async () => {
    const user = userEvent.setup();
    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export CSV'));

    expect(screen.getByTestId('export-modal')).toBeInTheDocument();
    expect(screen.getByTestId('export-entity')).toHaveTextContent('staff');
  });

  it('closes export modal', async () => {
    const user = userEvent.setup();
    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export CSV'));
    expect(screen.getByTestId('export-modal')).toBeInTheDocument();

    await user.click(screen.getByTestId('export-close'));
    expect(screen.queryByTestId('export-modal')).not.toBeInTheDocument();
  });
});

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
}));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), patch: jest.fn() },
}));
jest.mock('@/components/autonomy', () => ({
  AutonomySettings: ({ configs, onUpdate, loading }: any) => (
    <div data-testid="autonomy-settings">
      {configs?.length || 0} configs
      <button data-testid="update-btn" onClick={() => onUpdate('DEPOSIT_PENDING', 'AUTO')}>
        Update
      </button>
      {loading && <span data-testid="updating">Updating...</span>}
    </div>
  ),
}));
jest.mock('@/components/skeleton', () => ({
  FormSkeleton: () => <div data-testid="form-skeleton">Loading...</div>,
}));

jest.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="arrow-left-icon" />,
}));

jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { api } from '@/lib/api';
import AutonomySettingsPage from './page';

const mockApi = api as jest.Mocked<typeof api>;

const mockOpConfigs = [
  { actionType: 'DEPOSIT_PENDING', autonomyLevel: 'AUTO' },
  { actionType: '*', autonomyLevel: 'ASSISTED' },
];

function setupMocks(opConfigs = mockOpConfigs) {
  mockApi.get.mockImplementation((url: string) => {
    if (url === '/autonomy') return Promise.resolve(opConfigs);
    return Promise.resolve([]);
  });
}

describe('AutonomySettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state then renders settings', async () => {
    setupMocks();
    render(<AutonomySettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('autonomy-settings-page')).toBeInTheDocument();
    });
    expect(screen.getByText('2 configs')).toBeInTheDocument();
  });

  it('handles API error on load', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/autonomy') return Promise.reject(new Error('Network error'));
      return Promise.resolve([]);
    });

    render(<AutonomySettingsPage />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to load autonomy settings', 'error');
    });
  });

  it('updates autonomy level on action', async () => {
    setupMocks();
    mockApi.patch.mockResolvedValue({ actionType: 'DEPOSIT_PENDING', autonomyLevel: 'AUTO' });

    render(<AutonomySettingsPage />);
    await waitFor(() => screen.getByTestId('autonomy-settings'));

    fireEvent.click(screen.getByTestId('update-btn'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/autonomy/DEPOSIT_PENDING', {
        autonomyLevel: 'AUTO',
      });
    });
  });

  it('shows error toast on update failure', async () => {
    setupMocks();
    mockApi.patch.mockRejectedValue(new Error('Forbidden'));

    render(<AutonomySettingsPage />);
    await waitFor(() => screen.getByTestId('autonomy-settings'));

    fireEvent.click(screen.getByTestId('update-btn'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to update autonomy level', 'error');
    });
  });
});

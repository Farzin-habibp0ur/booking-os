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
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
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

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { api } from '@/lib/api';
import AutonomySettingsPage from './page';

const mockApi = api as jest.Mocked<typeof api>;

describe('AutonomySettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state then renders settings', async () => {
    mockApi.get.mockResolvedValue([
      { actionType: 'DEPOSIT_PENDING', autonomyLevel: 'AUTO' },
      { actionType: '*', autonomyLevel: 'ASSISTED' },
    ]);

    render(<AutonomySettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('autonomy-settings-page')).toBeInTheDocument();
    });
    expect(screen.getByText('2 configs')).toBeInTheDocument();
  });

  it('handles API error on load', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));

    render(<AutonomySettingsPage />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to load autonomy settings', 'error');
    });
  });

  it('updates autonomy level on action', async () => {
    mockApi.get.mockResolvedValue([{ actionType: '*', autonomyLevel: 'OFF' }]);
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
    mockApi.get.mockResolvedValue([]);
    mockApi.patch.mockRejectedValue(new Error('Forbidden'));

    render(<AutonomySettingsPage />);
    await waitFor(() => screen.getByTestId('autonomy-settings'));

    fireEvent.click(screen.getByTestId('update-btn'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to update autonomy level', 'error');
    });
  });
});

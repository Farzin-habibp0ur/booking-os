import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './page';

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
const mockSetTheme = jest.fn();
jest.mock('@/lib/use-theme', () => ({
  useTheme: () => ({ theme: 'light' as const, setTheme: mockSetTheme, toggle: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const mockBusiness = {
  name: 'Glow Clinic',
  phone: '+1234567890',
  timezone: 'America/New_York',
  verticalPack: 'aesthetics',
  slug: 'glow-clinic',
};

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockResolvedValue(mockBusiness);
  });

  test('renders settings page with title', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('settings.title')).toBeInTheDocument();
    });
  });

  test('displays business info section', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('settings.business_info')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Glow Clinic')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+1234567890')).toBeInTheDocument();
      expect(screen.getByDisplayValue('America/New_York')).toBeInTheDocument();
    });
  });

  test('shows vertical pack as disabled input', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      const packInput = screen.getByDisplayValue('aesthetics');
      expect(packInput).toBeDisabled();
    });
  });

  test('saves business info when save is clicked', async () => {
    mockApi.patch.mockResolvedValue({});
    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue('Glow Clinic'));

    // Modify name
    const nameInput = screen.getByDisplayValue('Glow Clinic');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'New Clinic');

    // Click save
    const saveButtons = screen.getAllByText('settings.save_changes');
    fireEvent.click(saveButtons[0]); // First save button is for business info

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/business',
        expect.objectContaining({
          name: 'New Clinic',
        }),
      );
    });
  });

  // ─── Change Password ──────────────────────────────────────────────────

  test('shows change password section', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('settings.change_password')).toBeInTheDocument();
      expect(screen.getByText('settings.current_password')).toBeInTheDocument();
      expect(screen.getByText('settings.new_password')).toBeInTheDocument();
      expect(screen.getByText('settings.confirm_password')).toBeInTheDocument();
      expect(screen.getByText('settings.update_password')).toBeInTheDocument();
    });
  });

  test('shows error for short password', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.change_password'));

    // Get password inputs by their preceding labels
    const passwordInputs = screen.getAllByRole('textbox', { hidden: true });
    // Use the actual password inputs
    const allInputs = document.querySelectorAll('input[type="password"]');
    if (allInputs.length >= 3) {
      fireEvent.change(allInputs[0], { target: { value: 'current' } });
      fireEvent.change(allInputs[1], { target: { value: 'short' } });
      fireEvent.change(allInputs[2], { target: { value: 'short' } });
    }

    fireEvent.click(screen.getByText('settings.update_password'));

    await waitFor(() => {
      expect(screen.getByText('settings.password_min_length')).toBeInTheDocument();
    });
  });

  test('shows error when passwords do not match', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.change_password'));

    const allInputs = document.querySelectorAll('input[type="password"]');
    if (allInputs.length >= 3) {
      fireEvent.change(allInputs[0], { target: { value: 'currentpass' } });
      fireEvent.change(allInputs[1], { target: { value: 'newpassword1' } });
      fireEvent.change(allInputs[2], { target: { value: 'newpassword2' } });
    }

    fireEvent.click(screen.getByText('settings.update_password'));

    await waitFor(() => {
      expect(screen.getByText('settings.passwords_no_match')).toBeInTheDocument();
    });
  });

  test('changes password successfully', async () => {
    mockApi.post.mockResolvedValue({});
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.change_password'));

    const allInputs = document.querySelectorAll('input[type="password"]');
    if (allInputs.length >= 3) {
      fireEvent.change(allInputs[0], { target: { value: 'currentpass' } });
      fireEvent.change(allInputs[1], { target: { value: 'newpassword123' } });
      fireEvent.change(allInputs[2], { target: { value: 'newpassword123' } });
    }

    fireEvent.click(screen.getByText('settings.update_password'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: 'currentpass',
        newPassword: 'newpassword123',
      });
    });
  });

  test('shows error when password change API fails', async () => {
    mockApi.post.mockRejectedValue(new Error('Wrong password'));
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.change_password'));

    const allInputs = document.querySelectorAll('input[type="password"]');
    if (allInputs.length >= 3) {
      fireEvent.change(allInputs[0], { target: { value: 'wrongpass' } });
      fireEvent.change(allInputs[1], { target: { value: 'newpassword123' } });
      fireEvent.change(allInputs[2], { target: { value: 'newpassword123' } });
    }

    fireEvent.click(screen.getByText('settings.update_password'));

    await waitFor(() => {
      expect(screen.getByText('Wrong password')).toBeInTheDocument();
    });
  });

  // ─── Booking Link ─────────────────────────────────────────────────────

  test('shows booking link card when slug exists', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('settings.booking_link')).toBeInTheDocument();
      expect(screen.getByText('settings.copy_link')).toBeInTheDocument();
    });
  });

  test('does not show booking link when slug is missing', async () => {
    mockApi.get.mockResolvedValue({ ...mockBusiness, slug: undefined });
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.title'));
    expect(screen.queryByText('settings.booking_link')).not.toBeInTheDocument();
  });

  // ─── Quick Links Navigation ───────────────────────────────────────────

  test('navigates to templates settings', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.message_templates'));

    fireEvent.click(screen.getByText('settings.message_templates'));

    expect(mockPush).toHaveBeenCalledWith('/settings/templates');
  });

  test('navigates to notifications settings', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.notifications'));

    fireEvent.click(screen.getByText('settings.notifications'));

    expect(mockPush).toHaveBeenCalledWith('/settings/notifications');
  });

  test('navigates to policies settings', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.policies'));

    fireEvent.click(screen.getByText('settings.policies'));

    expect(mockPush).toHaveBeenCalledWith('/settings/policies');
  });

  test('navigates to calendar sync settings', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.calendar_sync'));

    fireEvent.click(screen.getByText('settings.calendar_sync'));

    expect(mockPush).toHaveBeenCalledWith('/settings/calendar');
  });

  test('navigates to AI settings', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.ai_settings'));

    fireEvent.click(screen.getByText('settings.ai_settings'));

    expect(mockPush).toHaveBeenCalledWith('/settings/ai');
  });

  test('navigates to billing', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.billing'));

    fireEvent.click(screen.getByText('settings.billing'));

    expect(mockPush).toHaveBeenCalledWith('/settings/billing');
  });

  test('navigates to translations', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.translations'));

    fireEvent.click(screen.getByText('settings.translations'));

    expect(mockPush).toHaveBeenCalledWith('/settings/translations');
  });

  test('navigates to profile fields', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.profile_fields'));

    fireEvent.click(screen.getByText('settings.profile_fields'));

    expect(mockPush).toHaveBeenCalledWith('/settings/profile-fields');
  });

  test('navigates to setup wizard', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.setup_wizard'));

    fireEvent.click(screen.getByText('settings.setup_wizard'));

    expect(mockPush).toHaveBeenCalledWith('/setup');
  });

  test('navigates to account import', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('settings.account_import'));

    fireEvent.click(screen.getByText('settings.account_import'));

    expect(mockPush).toHaveBeenCalledWith('/settings/account');
  });

  // ─── Theme ────────────────────────────────────────────────────────────

  test('shows appearance section with theme buttons', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Appearance')).toBeInTheDocument();
      expect(screen.getByText('light')).toBeInTheDocument();
      expect(screen.getByText('dark')).toBeInTheDocument();
    });
  });

  test('sets theme when theme button is clicked', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('dark'));

    fireEvent.click(screen.getByText('dark'));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  // ─── Waitlist and Offers quick links ──────────────────────────────────

  test('shows waitlist and offers quick links', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Waitlist')).toBeInTheDocument();
      expect(screen.getByText('Offers')).toBeInTheDocument();
    });
  });

  test('navigates to waitlist settings', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('Waitlist'));

    fireEvent.click(screen.getByText('Waitlist'));

    expect(mockPush).toHaveBeenCalledWith('/settings/waitlist');
  });

  test('navigates to offers settings', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('Offers'));

    fireEvent.click(screen.getByText('Offers'));

    expect(mockPush).toHaveBeenCalledWith('/settings/offers');
  });

  // ─── AI Autonomy and Agent Skills ─────────────────────────────────

  test('shows AI Autonomy and Agent Skills links', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('AI Autonomy')).toBeInTheDocument();
      expect(screen.getByText('Agent Skills')).toBeInTheDocument();
    });
  });

  test('navigates to autonomy settings', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('AI Autonomy'));

    fireEvent.click(screen.getByText('AI Autonomy'));

    expect(mockPush).toHaveBeenCalledWith('/settings/autonomy');
  });

  test('navigates to agent skills settings', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('Agent Skills'));

    fireEvent.click(screen.getByText('Agent Skills'));

    expect(mockPush).toHaveBeenCalledWith('/settings/agents');
  });
});

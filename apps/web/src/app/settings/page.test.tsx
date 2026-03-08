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
jest.mock('lucide-react', () => {
  const stub = (name: string) => {
    const C = (props: any) => <svg data-testid={`icon-${name}`} {...props} />;
    C.displayName = name;
    return C;
  };
  return new Proxy(
    {},
    {
      get: (_target, prop: string) => stub(prop),
    },
  );
});
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
jest.mock('@/lib/design-tokens', () => ({
  ELEVATION: { card: 'shadow-soft rounded-2xl', cardSm: 'shadow-soft-sm rounded-xl' },
}));
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

    const nameInput = screen.getByDisplayValue('Glow Clinic');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'New Clinic');

    const saveButtons = screen.getAllByText('settings.save_changes');
    fireEvent.click(saveButtons[0]);

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

  // ─── Settings Hub Categories ──────────────────────────────────────────

  test('shows settings hub section heading', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('settings.more_settings')).toBeInTheDocument();
    });
  });

  test('renders all settings hub category cards for ADMIN role', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Account & Security')).toBeInTheDocument();
      expect(screen.getByText('Operations')).toBeInTheDocument();
      expect(screen.getByText('Communication')).toBeInTheDocument();
      expect(screen.getByText('AI & Automation')).toBeInTheDocument();
      expect(screen.getByText('Growth')).toBeInTheDocument();
      expect(screen.getByText('Billing')).toBeInTheDocument();
      expect(screen.getByText('Appearance')).toBeInTheDocument();
    });
  });

  test('displays category descriptions', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Team accounts, login methods, and custom profile fields')).toBeInTheDocument();
      expect(screen.getByText('Calendar rules, message templates, and booking policies')).toBeInTheDocument();
      expect(screen.getByText('Notification preferences and language translations')).toBeInTheDocument();
      expect(screen.getByText('AI assistant, autonomy levels, and background agents')).toBeInTheDocument();
    });
  });

  test('navigates to account settings when Account & Security card is clicked', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('Account & Security'));

    fireEvent.click(screen.getByText('Account & Security'));

    expect(mockPush).toHaveBeenCalledWith('/settings/account');
  });

  test('navigates to calendar settings when Operations card is clicked', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('Operations'));

    fireEvent.click(screen.getByText('Operations'));

    expect(mockPush).toHaveBeenCalledWith('/settings/calendar');
  });

  test('navigates to notifications settings when Communication card is clicked', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('Communication'));

    fireEvent.click(screen.getByText('Communication'));

    expect(mockPush).toHaveBeenCalledWith('/settings/notifications');
  });

  test('navigates to AI settings when AI & Automation card is clicked', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('AI & Automation'));

    fireEvent.click(screen.getByText('AI & Automation'));

    expect(mockPush).toHaveBeenCalledWith('/settings/ai');
  });

  test('navigates to waitlist settings when Growth card is clicked', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('Growth'));

    fireEvent.click(screen.getByText('Growth'));

    expect(mockPush).toHaveBeenCalledWith('/settings/waitlist');
  });

  test('navigates to billing settings when Billing card is clicked', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('Billing'));

    fireEvent.click(screen.getByText('Billing'));

    expect(mockPush).toHaveBeenCalledWith('/settings/billing');
  });

  test('navigates to settings root when Appearance card is clicked (no sub-pages)', async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByText('Appearance'));

    fireEvent.click(screen.getByText('Appearance'));

    expect(mockPush).toHaveBeenCalledWith('/settings');
  });
});

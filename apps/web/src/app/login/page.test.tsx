import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPageWrapper from './page';

// Mock next/navigation
const mockPush = jest.fn();
const mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
});

// Mock auth
const mockLogin = jest.fn();
const mockComplete2FA = jest.fn();
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ login: mockLogin, complete2FA: mockComplete2FA, user: null, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

// Mock i18n
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  I18nProvider: ({ children }: any) => children,
}));

// Mock LanguagePicker
jest.mock('@/components/language-picker', () => ({
  LanguagePicker: () => <div data-testid="language-picker">LanguagePicker</div>,
}));

// Mock posthog
jest.mock('@/lib/posthog', () => ({
  trackEvent: jest.fn(),
  identifyUser: jest.fn(),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.delete('reset');
  });

  it('renders login form with email and password fields', () => {
    render(<LoginPageWrapper />);

    // Check for email input by type
    const emailInput = screen.getByRole('textbox');
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'email');

    // Check for password input
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBe(1);

    // Check for submit button
    expect(screen.getByRole('button', { name: 'login.sign_in' })).toBeInTheDocument();
  });

  it('calls login on form submit', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ role: 'ADMIN' });

    render(<LoginPageWrapper />);

    const emailInput = screen.getByRole('textbox');
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: 'login.sign_in' });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('redirects to /dashboard on success', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ role: 'ADMIN' });

    render(<LoginPageWrapper />);

    const emailInput = screen.getByRole('textbox');
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: 'login.sign_in' });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error message on login failure', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    render(<LoginPageWrapper />);

    const emailInput = screen.getByRole('textbox');
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: 'login.sign_in' });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('disables submit button while loading', async () => {
    const user = userEvent.setup();
    let resolveLogin: () => void;
    const loginPromise = new Promise<void>((resolve) => {
      resolveLogin = resolve;
    });
    mockLogin.mockReturnValue(loginPromise);

    render(<LoginPageWrapper />);

    const emailInput = screen.getByRole('textbox');
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: 'login.sign_in' });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    // Button should be disabled while loading
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(screen.getByText('login.signing_in')).toBeInTheDocument();
    });

    // Resolve the login
    resolveLogin!();
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('redirects SUPER_ADMIN to /console after login', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ role: 'SUPER_ADMIN' });

    render(<LoginPageWrapper />);

    const emailInput = screen.getByRole('textbox');
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: 'login.sign_in' });

    await user.type(emailInput, 'admin@businesscommandcentre.com');
    await user.type(passwordInput, 'superadmin123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/console');
    });
  });

  it('shows password reset success banner when reset=success param', () => {
    mockSearchParams.set('reset', 'success');

    render(<LoginPageWrapper />);

    expect(screen.getByText('login.reset_success')).toBeInTheDocument();
  });

  it('renders language picker', () => {
    render(<LoginPageWrapper />);

    expect(screen.getByTestId('language-picker')).toBeInTheDocument();
  });

  // P-17: Two-Factor Authentication tests
  describe('2FA flow', () => {
    it('shows 2FA screen when login returns requires2FA', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ requires2FA: true, tempToken: 'temp-abc' });

      render(<LoginPageWrapper />);

      const emailInput = screen.getByRole('textbox');
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: 'login.sign_in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
      });

      expect(screen.getByTestId('2fa-code-input')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-backup-code')).toBeInTheDocument();
    });

    it('calls complete2FA and redirects on valid 2FA code', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ requires2FA: true, tempToken: 'temp-abc' });
      mockComplete2FA.mockResolvedValue({ id: 'u1', email: 'test@test.com', role: 'ADMIN' });

      render(<LoginPageWrapper />);

      // Submit login form
      const emailInput = screen.getByRole('textbox');
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(screen.getByRole('button', { name: 'login.sign_in' }));

      await waitFor(() => {
        expect(screen.getByTestId('2fa-code-input')).toBeInTheDocument();
      });

      // Enter 2FA code
      await user.type(screen.getByTestId('2fa-code-input'), '123456');
      await user.click(screen.getByTestId('2fa-submit'));

      await waitFor(() => {
        expect(mockComplete2FA).toHaveBeenCalledWith('temp-abc', '123456');
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('toggles between TOTP and backup code mode', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ requires2FA: true, tempToken: 'temp-abc' });

      render(<LoginPageWrapper />);

      const emailInput = screen.getByRole('textbox');
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(screen.getByRole('button', { name: 'login.sign_in' }));

      await waitFor(() => {
        expect(screen.getByTestId('toggle-backup-code')).toBeInTheDocument();
      });

      // Toggle to backup code mode
      await user.click(screen.getByTestId('toggle-backup-code'));

      expect(screen.getByText('Enter one of your backup codes')).toBeInTheDocument();
    });

    it('shows error on failed 2FA verification', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ requires2FA: true, tempToken: 'temp-abc' });
      mockComplete2FA.mockRejectedValue(new Error('Invalid 2FA code'));

      render(<LoginPageWrapper />);

      const emailInput = screen.getByRole('textbox');
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(screen.getByRole('button', { name: 'login.sign_in' }));

      await waitFor(() => {
        expect(screen.getByTestId('2fa-code-input')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('2fa-code-input'), '000000');
      await user.click(screen.getByTestId('2fa-submit'));

      await waitFor(() => {
        expect(screen.getByText('Invalid 2FA code')).toBeInTheDocument();
      });
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPageWrapper from './page';

const mockPush = jest.fn();
const mockLogin = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/login',
}));

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    loading: false,
    login: mockLogin,
    logout: jest.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    setLocale: jest.fn(),
    t: (key: string) => {
      const map: Record<string, string> = {
        'login.title': 'Welcome back',
        'login.subtitle': 'Sign in to your account',
        'login.email_label': 'Email',
        'login.password_label': 'Password',
        'login.sign_in': 'Sign in',
        'login.signing_in': 'Signing in...',
        'login.dev_hint': 'Dev hint',
        'errors.login_failed': 'Login failed',
      };
      return map[key] ?? key;
    },
  }),
  I18nProvider: ({ children }: any) => children,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function getEmailInput() {
  return screen.getByRole('textbox');
}

function getPasswordInput() {
  // password inputs don't have an accessible role, query by type
  return document.querySelector('input[type="password"]') as HTMLInputElement;
}

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    render(<LoginPageWrapper />);
    expect(getEmailInput()).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
  });

  it('shows error message on failed login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
    const user = userEvent.setup();

    render(<LoginPageWrapper />);
    await user.type(getEmailInput(), 'test@test.com');
    await user.type(getPasswordInput(), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('navigates to /dashboard on success', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<LoginPageWrapper />);
    await user.type(getEmailInput(), 'test@test.com');
    await user.type(getPasswordInput(), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });
});

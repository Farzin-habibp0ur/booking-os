import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth';
import { api } from './api';

// Mock the api module
jest.mock('./api', () => ({
  api: {
    getToken: jest.fn(),
    setToken: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock window.location
delete (window as any).location;
window.location = { href: '' } as any;

// Test component that uses useAuth
function TestComponent() {
  const { user, loading, login, signup, logout } = useAuth();

  if (loading) return <div>Loading...</div>;

  const handleLogin = async () => {
    try {
      await login('test@example.com', 'password');
    } catch (error) {
      // Error is handled - do nothing
    }
  };

  const handleSignup = async () => {
    try {
      await signup('My Business', 'Owner Name', 'test@example.com', 'password');
    } catch (error) {
      // Error handled
    }
  };

  return (
    <div>
      <div data-testid="user-status">{user ? `Logged in as ${user.email}` : 'Not logged in'}</div>
      <div data-testid="has-signup">{typeof signup === 'function' ? 'yes' : 'no'}</div>
      <button onClick={handleLogin}>Login</button>
      <button onClick={handleSignup}>Signup</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin',
    locale: 'en',
    businessId: 'business-1',
    business: {
      id: 'business-1',
      name: 'Test Business',
      slug: 'test-business',
      verticalPack: 'spa',
      defaultLocale: 'en',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (api.getToken as jest.Mock).mockReturnValue(null);
    (api.get as jest.Mock).mockResolvedValue(mockUser);
    (api.post as jest.Mock).mockResolvedValue({ accessToken: 'new-token', staff: mockUser });
  });

  it('shows loading state initially when token exists', () => {
    (api.getToken as jest.Mock).mockReturnValue('existing-token');
    (api.get as jest.Mock).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('fetches /auth/me on mount when token exists', async () => {
    (api.getToken as jest.Mock).mockReturnValue('existing-token');
    (api.get as jest.Mock).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/me');
    });
  });

  it('sets user after successful /auth/me', async () => {
    (api.getToken as jest.Mock).mockReturnValue('existing-token');
    (api.get as jest.Mock).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Logged in as test@example.com');
    });
  });

  it('shows not logged in on failed /auth/me (C2: cookie-based auth)', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');
    });
  });

  it('always fetches /auth/me on mount (C2: cookie-based auth)', async () => {
    (api.getToken as jest.Mock).mockReturnValue(null);
    (api.get as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/me');
      expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');
    });
  });

  it('login() calls api.post and api.get without storing token (C2 fix)', async () => {
    (api.getToken as jest.Mock).mockReturnValue(null);
    (api.post as jest.Mock).mockResolvedValue({ accessToken: 'new-token', staff: mockUser });
    // First call to /auth/me on mount fails, second after login succeeds
    (api.get as jest.Mock)
      .mockRejectedValueOnce(new Error('Unauthorized'))
      .mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');
    });

    const loginButton = screen.getByText('Login');

    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password',
      });
      // C2 fix: Should NOT store token in localStorage
      expect(api.setToken).not.toHaveBeenCalledWith('new-token');
      expect(api.get).toHaveBeenCalledWith('/auth/me');
      expect(screen.getByTestId('user-status')).toHaveTextContent('Logged in as test@example.com');
    });
  });

  it('logout() clears token and redirects', async () => {
    (api.getToken as jest.Mock).mockReturnValue('existing-token');
    (api.get as jest.Mock).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Logged in as test@example.com');
    });

    const logoutButton = screen.getByText('Logout');

    await act(async () => {
      logoutButton.click();
    });

    await waitFor(() => {
      expect(api.setToken).toHaveBeenCalledWith(null);
      expect(window.location.href).toBe('/login');
    });
  });

  it('handles login errors gracefully', async () => {
    // Suppress console.error for this test since we expect an error
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    (api.getToken as jest.Mock).mockReturnValue(null);
    // Mount: /auth/me fails (no session), Login: post fails
    (api.get as jest.Mock).mockRejectedValue(new Error('Unauthorized'));
    (api.post as jest.Mock).mockImplementation(() =>
      Promise.reject(new Error('Invalid credentials')),
    );

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');
    });

    const loginButton = screen.getByText('Login');

    // Click the button and wait for the async operation to complete
    await act(async () => {
      loginButton.click();
      // Give time for the promise to settle
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });

    // User should still be not logged in after failed login
    expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');

    consoleError.mockRestore();
  });

  it('provides token from api.getToken', async () => {
    (api.getToken as jest.Mock).mockReturnValue('test-token');
    (api.get as jest.Mock).mockResolvedValue(mockUser);

    function TokenComponent() {
      const { token } = useAuth();
      return <div data-testid="token">{token}</div>;
    }

    render(
      <AuthProvider>
        <TokenComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('token')).toHaveTextContent('test-token');
    });
  });

  it('stops loading after /auth/me completes (C2: always tries cookie auth)', async () => {
    (api.getToken as jest.Mock).mockReturnValue(null);
    (api.get as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

    function LoadingComponent() {
      const { loading, user } = useAuth();
      return (
        <div>
          <div data-testid="loading">{loading ? 'true' : 'false'}</div>
          <div data-testid="user">{user ? 'logged in' : 'not logged in'}</div>
        </div>
      );
    }

    render(
      <AuthProvider>
        <LoadingComponent />
      </AuthProvider>,
    );

    // Should stop loading after /auth/me completes (even on failure)
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('not logged in');
  });

  it('signup() calls api.post /auth/signup and fetches /auth/me', async () => {
    (api.getToken as jest.Mock).mockReturnValue(null);
    (api.post as jest.Mock).mockResolvedValue({ accessToken: 'signup-token', staff: mockUser });
    // First call to /auth/me on mount fails, second after signup succeeds
    (api.get as jest.Mock)
      .mockRejectedValueOnce(new Error('Unauthorized'))
      .mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');
    });

    const signupButton = screen.getByText('Signup');

    await act(async () => {
      signupButton.click();
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/signup', {
        businessName: 'My Business',
        ownerName: 'Owner Name',
        email: 'test@example.com',
        password: 'password',
      });
      expect(api.get).toHaveBeenCalledWith('/auth/me');
      expect(screen.getByTestId('user-status')).toHaveTextContent('Logged in as test@example.com');
    });
  });

  it('signup() handles errors gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    (api.getToken as jest.Mock).mockReturnValue(null);
    (api.get as jest.Mock).mockRejectedValue(new Error('Unauthorized'));
    (api.post as jest.Mock).mockRejectedValue(new Error('Email already exists'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');
    });

    const signupButton = screen.getByText('Signup');

    await act(async () => {
      signupButton.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });

    // User should still be not logged in after failed signup
    expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');

    consoleError.mockRestore();
  });

  it('logout() calls api.post /auth/logout before clearing', async () => {
    (api.getToken as jest.Mock).mockReturnValue('existing-token');
    (api.get as jest.Mock).mockResolvedValue(mockUser);
    (api.post as jest.Mock).mockResolvedValue({});

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Logged in as test@example.com');
    });

    const logoutButton = screen.getByText('Logout');

    await act(async () => {
      logoutButton.click();
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/logout');
      expect(api.setToken).toHaveBeenCalledWith(null);
      expect(window.location.href).toBe('/login');
    });
  });

  it('logout() redirects even if /auth/logout API fails', async () => {
    (api.getToken as jest.Mock).mockReturnValue('existing-token');
    (api.get as jest.Mock).mockResolvedValue(mockUser);
    (api.post as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Logged in as test@example.com');
    });

    const logoutButton = screen.getByText('Logout');

    await act(async () => {
      logoutButton.click();
    });

    await waitFor(() => {
      expect(api.setToken).toHaveBeenCalledWith(null);
      expect(window.location.href).toBe('/login');
    });
  });

  it('provides signup in context', async () => {
    (api.getToken as jest.Mock).mockReturnValue(null);
    (api.get as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('has-signup')).toHaveTextContent('yes');
    });
  });
});

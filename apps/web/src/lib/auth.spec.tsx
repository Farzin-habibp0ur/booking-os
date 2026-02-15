import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth';
import { api } from './api';

jest.mock('./api', () => ({
  api: {
    getToken: jest.fn(),
    setToken: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

function TestConsumer() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? user.name : 'no user'}</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('user is null when no token exists', async () => {
    mockApi.getToken.mockReturnValue(null);

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>,
      );
    });

    expect(screen.getByText('no user')).toBeInTheDocument();
  });

  it('sets user after login', async () => {
    mockApi.getToken.mockReturnValue(null);
    mockApi.post.mockResolvedValue({ accessToken: 'tok123', staff: {} });
    mockApi.get.mockResolvedValue({ id: '1', name: 'Sarah', email: 'sarah@test.com', role: 'owner', locale: null, businessId: 'b1', business: { id: 'b1', name: 'Biz', slug: 'biz', verticalPack: 'beauty', defaultLocale: 'en' } });

    function LoginConsumer() {
      const { user, loading, login } = useAuth();
      if (loading) return <div>loading</div>;
      return (
        <div>
          <span>{user ? user.name : 'no user'}</span>
          <button onClick={() => login('sarah@test.com', 'pass')}>login</button>
        </div>
      );
    }

    await act(async () => {
      render(
        <AuthProvider>
          <LoginConsumer />
        </AuthProvider>,
      );
    });

    expect(screen.getByText('no user')).toBeInTheDocument();

    await act(async () => {
      screen.getByText('login').click();
    });

    expect(screen.getByText('Sarah')).toBeInTheDocument();
  });
});

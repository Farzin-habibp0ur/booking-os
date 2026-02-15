import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignupPage from './page';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/signup',
}));

const mockPost = jest.fn();
const mockSetToken = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    post: (...args: any[]) => mockPost(...args),
    setToken: (...args: any[]) => mockSetToken(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function getField(name: string) {
  if (name === 'Password') {
    return screen.getByPlaceholderText('Minimum 8 characters');
  }
  // text and email inputs are accessible via role
  return screen.getByRole(name === 'Email' ? 'textbox' : 'textbox', {
    name: new RegExp(name, 'i'),
  });
}

describe('SignupPage', () => {
  it('renders all 4 form fields', () => {
    render(<SignupPage />);
    expect(screen.getByText('Business name')).toBeInTheDocument();
    expect(screen.getByText('Your name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  it('shows error on API failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Email already taken'));
    const user = userEvent.setup();

    render(<SignupPage />);
    await user.type(screen.getByPlaceholderText('Glow Clinic'), 'My Biz');
    await user.type(screen.getByPlaceholderText('Sarah Johnson'), 'John');
    await user.type(document.querySelector('input[type="email"]') as HTMLInputElement, 'john@test.com');
    await user.type(screen.getByPlaceholderText('Minimum 8 characters'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('Email already taken')).toBeInTheDocument();
    });
  });

  it('navigates to /setup on success', async () => {
    mockPost.mockResolvedValueOnce({ accessToken: 'tok', staff: {} });
    const user = userEvent.setup();

    render(<SignupPage />);
    await user.type(screen.getByPlaceholderText('Glow Clinic'), 'My Biz');
    await user.type(screen.getByPlaceholderText('Sarah Johnson'), 'John');
    await user.type(document.querySelector('input[type="email"]') as HTMLInputElement, 'john@test.com');
    await user.type(screen.getByPlaceholderText('Minimum 8 characters'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(mockSetToken).toHaveBeenCalledWith('tok');
      expect(mockPush).toHaveBeenCalledWith('/setup');
    });
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ForgotPasswordPage from './page';

jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn(),
  },
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders email input and submit button', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText('Send reset link')).toBeInTheDocument();
    expect(screen.getByText('Back to sign in')).toBeInTheDocument();
  });

  it('shows success message after submitting email', async () => {
    mockApi.post.mockResolvedValue({});
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText(/we've sent a password reset link/i)).toBeInTheDocument();
    });
    expect(mockApi.post).toHaveBeenCalledWith('/auth/forgot-password', {
      email: 'test@example.com',
    });
  });

  it('shows error message on failure', async () => {
    mockApi.post.mockRejectedValue(new Error('Network error'));
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('has link back to login page', () => {
    render(<ForgotPasswordPage />);
    const link = screen.getByText('Back to sign in');
    expect(link.closest('a')).toHaveAttribute('href', '/login');
  });
});

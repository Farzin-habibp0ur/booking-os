const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  useParams: () => ({ slug: 'test-clinic' }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PortalLoginPage from './page';

const mockSessionStorage: Record<string, string> = {};
beforeAll(() => {
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: (key: string) => mockSessionStorage[key] ?? null,
      setItem: (key: string, val: string) => { mockSessionStorage[key] = val; },
      removeItem: (key: string) => { delete mockSessionStorage[key]; },
    },
    writable: true,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
  (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ name: 'Test Clinic' }),
  });
});

describe('PortalLoginPage', () => {
  it('renders login form with phone and email tabs', () => {
    render(<PortalLoginPage />);

    expect(screen.getByText('Sign in to manage your bookings')).toBeInTheDocument();
    expect(screen.getByTestId('tab-phone')).toBeInTheDocument();
    expect(screen.getByTestId('tab-email')).toBeInTheDocument();
    expect(screen.getByTestId('phone-tab')).toBeInTheDocument();
  });

  it('shows phone input by default', () => {
    render(<PortalLoginPage />);

    expect(screen.getByTestId('phone-input')).toBeInTheDocument();
    expect(screen.getByTestId('send-otp-btn')).toBeInTheDocument();
  });

  it('switches to email tab', () => {
    render(<PortalLoginPage />);

    fireEvent.click(screen.getByTestId('tab-email'));
    expect(screen.getByTestId('email-tab')).toBeInTheDocument();
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('send-magic-link-btn')).toBeInTheDocument();
  });

  it('OTP flow: sends code and shows OTP inputs', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ name: 'Test Clinic' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ message: 'Verification code sent' }) });

    render(<PortalLoginPage />);

    fireEvent.change(screen.getByTestId('phone-input'), { target: { value: '+1234567890' } });
    fireEvent.click(screen.getByTestId('send-otp-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('otp-inputs')).toBeInTheDocument();
    });
    expect(screen.getByTestId('verify-otp-btn')).toBeInTheDocument();
  });

  it('OTP flow: verifies code and redirects to dashboard', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ name: 'Test Clinic' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ message: 'Verification code sent' }) });

    render(<PortalLoginPage />);

    fireEvent.change(screen.getByTestId('phone-input'), { target: { value: '+1234567890' } });
    fireEvent.click(screen.getByTestId('send-otp-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('otp-inputs')).toBeInTheDocument();
    });

    // Fill in OTP digits
    const inputs = screen.getByTestId('otp-inputs').querySelectorAll('input');
    inputs.forEach((input, i) => {
      fireEvent.change(input, { target: { value: String(i + 1) } });
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'jwt-portal-token' }),
    });

    fireEvent.click(screen.getByTestId('verify-otp-btn'));

    await waitFor(() => {
      expect(mockSessionStorage['portal-token']).toBe('jwt-portal-token');
      expect(mockReplace).toHaveBeenCalledWith('/portal/test-clinic/dashboard');
    });
  });

  it('magic link flow: sends email and shows confirmation', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ name: 'Test Clinic' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ message: 'Magic link sent' }) });

    render(<PortalLoginPage />);

    fireEvent.click(screen.getByTestId('tab-email'));
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'jane@test.com' } });
    fireEvent.click(screen.getByTestId('send-magic-link-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('email-sent-confirmation')).toBeInTheDocument();
    });
    expect(screen.getByText(/Check your email/)).toBeInTheDocument();
  });

  it('shows error message on failed OTP request', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ name: 'Test Clinic' }) })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ message: 'Customer not found' }) });

    render(<PortalLoginPage />);

    fireEvent.change(screen.getByTestId('phone-input'), { target: { value: '+0000000000' } });
    fireEvent.click(screen.getByTestId('send-otp-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
    expect(screen.getByText('Customer not found')).toBeInTheDocument();
  });

  it('send OTP button is disabled when phone is empty', () => {
    render(<PortalLoginPage />);

    const btn = screen.getByTestId('send-otp-btn');
    expect(btn).toBeDisabled();
  });
});

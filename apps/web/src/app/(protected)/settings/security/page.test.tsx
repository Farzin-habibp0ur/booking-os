import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SecuritySettingsPage from './page';

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
});

// Mock api
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
  },
}));

describe('SecuritySettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "Enable 2FA" button when 2FA is disabled', async () => {
    mockGet.mockResolvedValue({ enabled: false, backupCodesRemaining: 0 });

    render(<SecuritySettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('enable-2fa-btn')).toBeInTheDocument();
    });
  });

  it('shows "Disable 2FA" button when 2FA is enabled', async () => {
    mockGet.mockResolvedValue({ enabled: true, backupCodesRemaining: 8 });

    render(<SecuritySettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('disable-2fa-btn')).toBeInTheDocument();
    });

    expect(screen.getByText('8 backup codes remaining')).toBeInTheDocument();
  });

  it('shows setup step with secret after clicking Enable', async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ enabled: false, backupCodesRemaining: 0 });
    mockPost.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauthUrl: 'otpauth://totp/BookingOS:test@test.com?secret=JBSWY3DPEHPK3PXP',
    });

    render(<SecuritySettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('enable-2fa-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('enable-2fa-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('2fa-setup-step')).toBeInTheDocument();
    });

    expect(screen.getByTestId('2fa-secret')).toHaveTextContent('JBSWY3DPEHPK3PXP');
    expect(mockPost).toHaveBeenCalledWith('/auth/2fa/setup');
  });

  it('shows backup codes after successful verification', async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ enabled: false, backupCodesRemaining: 0 });
    mockPost.mockResolvedValueOnce({
      secret: 'TESTSECRET',
      otpauthUrl: 'otpauth://totp/...',
    });
    mockPost.mockResolvedValueOnce({
      backupCodes: [
        'CODE1111',
        'CODE2222',
        'CODE3333',
        'CODE4444',
        'CODE5555',
        'CODE6666',
        'CODE7777',
        'CODE8888',
      ],
    });

    render(<SecuritySettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('enable-2fa-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('enable-2fa-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('2fa-verify-input')).toBeInTheDocument();
    });

    await user.type(screen.getByTestId('2fa-verify-input'), '123456');
    await user.click(screen.getByTestId('2fa-verify-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('2fa-backup-step')).toBeInTheDocument();
    });

    const codes = screen.getAllByTestId('backup-code');
    expect(codes).toHaveLength(8);
    expect(screen.getByTestId('download-backup-btn')).toBeInTheDocument();
  });

  it('shows disable form and disables 2FA', async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ enabled: true, backupCodesRemaining: 6 });
    mockPost.mockResolvedValue({ ok: true });

    render(<SecuritySettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('disable-2fa-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('disable-2fa-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('2fa-disable-step')).toBeInTheDocument();
    });

    await user.type(screen.getByTestId('2fa-disable-input'), '123456');
    await user.click(screen.getByTestId('2fa-disable-confirm-btn'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/2fa/disable', { code: '123456' });
    });

    // After disable, should show enable button again
    await waitFor(() => {
      expect(screen.getByTestId('enable-2fa-btn')).toBeInTheDocument();
    });
  });

  it('shows low backup code warning when remaining <= 2', async () => {
    mockGet.mockResolvedValue({ enabled: true, backupCodesRemaining: 1 });

    render(<SecuritySettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/You only have 1 backup code remaining/)).toBeInTheDocument();
    });
  });

  it('shows error when setup verification fails', async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ enabled: false, backupCodesRemaining: 0 });
    mockPost.mockResolvedValueOnce({
      secret: 'TESTSECRET',
      otpauthUrl: 'otpauth://totp/...',
    });
    mockPost.mockRejectedValueOnce(new Error('Invalid verification code'));

    render(<SecuritySettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('enable-2fa-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('enable-2fa-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('2fa-verify-input')).toBeInTheDocument();
    });

    await user.type(screen.getByTestId('2fa-verify-input'), '000000');
    await user.click(screen.getByTestId('2fa-verify-btn'));

    await waitFor(() => {
      expect(screen.getByText('Invalid verification code')).toBeInTheDocument();
    });
  });
});

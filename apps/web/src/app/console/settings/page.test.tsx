jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/console/settings',
}));

jest.mock('lucide-react', () => {
  const icons = ['Shield', 'Bell', 'Globe', 'Settings', 'AlertTriangle'];
  const mocks: Record<string, any> = {};
  icons.forEach((name) => {
    mocks[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />;
  });
  return mocks;
});

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import ConsoleSettingsPage from './page';

const { api } = jest.requireMock<{ api: jest.Mocked<(typeof import('@/lib/api'))['api']> }>(
  '@/lib/api',
);

const mockSettings = {
  security: [
    { key: 'security.sessionTimeoutMins', value: 60, isDefault: true },
    { key: 'security.requireEmailVerification', value: true, isDefault: true },
    { key: 'security.maxViewAsSessionMins', value: 15, isDefault: true },
    { key: 'security.maxLoginAttempts', value: 5, isDefault: true },
  ],
  notifications: [
    { key: 'notifications.defaultReminderHours', value: 24, isDefault: true },
    { key: 'notifications.quietHoursStart', value: '22:00', isDefault: true },
    { key: 'notifications.quietHoursEnd', value: '07:00', isDefault: true },
  ],
  regional: [
    { key: 'regional.defaultTimezone', value: 'UTC', isDefault: true },
    { key: 'regional.defaultLocale', value: 'en', isDefault: true },
    { key: 'regional.defaultCurrency', value: 'USD', isDefault: true },
  ],
  platform: [
    { key: 'platform.maintenanceMode', value: false, isDefault: true },
    { key: 'platform.maxTenantsAllowed', value: 100, isDefault: true },
    { key: 'platform.apiRateLimitPerMin', value: 60, isDefault: true },
  ],
};

describe('ConsoleSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue(mockSettings);
    api.put.mockResolvedValue([]);
  });

  it('shows loading state initially', () => {
    api.get.mockImplementation(() => new Promise(() => {}));
    render(<ConsoleSettingsPage />);
    expect(screen.getByTestId('settings-loading')).toBeInTheDocument();
  });

  it('renders all 4 category sections', async () => {
    render(<ConsoleSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Platform Settings')).toBeInTheDocument();
    });
    expect(screen.getByTestId('section-security')).toBeInTheDocument();
    expect(screen.getByTestId('section-notifications')).toBeInTheDocument();
    expect(screen.getByTestId('section-regional')).toBeInTheDocument();
    expect(screen.getByTestId('section-platform')).toBeInTheDocument();
  });

  it('renders security inputs with correct values', async () => {
    render(<ConsoleSettingsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('input-sessionTimeout')).toBeInTheDocument();
    });
    expect(screen.getByTestId('input-sessionTimeout')).toHaveValue(60);
    expect(screen.getByTestId('input-maxViewAs')).toHaveValue(15);
    expect(screen.getByTestId('input-maxLogin')).toHaveValue(5);
  });

  it('renders notification inputs', async () => {
    render(<ConsoleSettingsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('input-reminderHours')).toBeInTheDocument();
    });
    expect(screen.getByTestId('input-reminderHours')).toHaveValue(24);
    expect(screen.getByTestId('input-quietStart')).toHaveValue('22:00');
    expect(screen.getByTestId('input-quietEnd')).toHaveValue('07:00');
  });

  it('renders regional dropdowns', async () => {
    render(<ConsoleSettingsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('input-timezone')).toBeInTheDocument();
    });
    expect(screen.getByTestId('input-timezone')).toHaveValue('UTC');
    expect(screen.getByTestId('input-locale')).toHaveValue('en');
    expect(screen.getByTestId('input-currency')).toHaveValue('USD');
  });

  it('renders platform inputs', async () => {
    render(<ConsoleSettingsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('input-maxTenants')).toBeInTheDocument();
    });
    expect(screen.getByTestId('input-maxTenants')).toHaveValue(100);
    expect(screen.getByTestId('input-rateLimit')).toHaveValue(60);
  });

  it('calls bulk update endpoint on save', async () => {
    render(<ConsoleSettingsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('save-security')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-security'));
    });

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/admin/settings/bulk', {
        settings: expect.arrayContaining([
          expect.objectContaining({ key: 'security.sessionTimeoutMins' }),
        ]),
      });
    });
  });

  it('shows maintenance mode confirmation modal', async () => {
    render(<ConsoleSettingsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('input-maintenanceMode')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('input-maintenanceMode'));

    expect(screen.getByTestId('maintenance-modal')).toBeInTheDocument();
    expect(screen.getByText('Enable Maintenance Mode?')).toBeInTheDocument();
  });

  it('cancels maintenance mode confirmation', async () => {
    render(<ConsoleSettingsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('input-maintenanceMode')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('input-maintenanceMode'));
    fireEvent.click(screen.getByTestId('maintenance-cancel'));

    expect(screen.queryByTestId('maintenance-modal')).not.toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    api.get.mockRejectedValue(new Error('Network error'));
    render(<ConsoleSettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('shows success toast after saving', async () => {
    render(<ConsoleSettingsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('save-security')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-security'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('success-toast')).toBeInTheDocument();
      expect(screen.getByText('Security settings saved')).toBeInTheDocument();
    });
  });

  it('confirms maintenance mode and shows warning', async () => {
    render(<ConsoleSettingsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('input-maintenanceMode')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('input-maintenanceMode'));
    fireEvent.click(screen.getByTestId('maintenance-confirm'));

    await waitFor(() => {
      expect(screen.queryByTestId('maintenance-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('maintenance-warning')).toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import SettingsPage from './page';

beforeEach(() => resetMocks());

describe('SettingsPage', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<SettingsPage />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockResolvedValue({
      security: [
        { key: 'maxLoginAttempts', value: 5, isDefault: true },
      ],
      notifications: [
        { key: 'emailNotifications', value: true, isDefault: true },
      ],
      regional: [
        { key: 'defaultTimezone', value: 'UTC', isDefault: true },
      ],
      platform: [
        { key: 'maintenanceMode', value: false, isDefault: true },
      ],
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Platform Settings')).toBeInTheDocument();
    });
  });
});

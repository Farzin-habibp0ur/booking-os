import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>);
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: '1', name: 'Sarah', role: 'OWNER', businessId: 'b1' }, loading: false }),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
  I18nProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({ name: 'general', labels: { customer: 'Customer', booking: 'Booking', service: 'Service' }, customerFields: [] }),
}));
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders settings page with title', async () => {
    mockApi.get.mockResolvedValue({
      name: 'Test Clinic',
      phone: '+1234',
      timezone: 'America/New_York',
      verticalPack: 'general',
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('settings.title')).toBeInTheDocument();
    });
  });

  test('displays business name input', async () => {
    mockApi.get.mockResolvedValue({
      name: 'Test Clinic',
      phone: '+1234',
      timezone: 'America/New_York',
      verticalPack: 'general',
    });

    render(<SettingsPage />);

    await waitFor(() => {
      const input = screen.getByDisplayValue('Test Clinic');
      expect(input).toBeInTheDocument();
    });
  });

  test('has save button', async () => {
    mockApi.get.mockResolvedValue({
      name: 'Test Clinic',
      phone: '+1234',
      timezone: 'America/New_York',
      verticalPack: 'general',
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('settings.save_changes')).toBeInTheDocument();
    });
  });

  test('shows quick links section', async () => {
    mockApi.get.mockResolvedValue({
      name: 'Test Clinic',
      phone: '+1234',
      timezone: 'America/New_York',
      verticalPack: 'general',
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('settings.ai_settings')).toBeInTheDocument();
    });
  });

  test('shows billing quick link', async () => {
    mockApi.get.mockResolvedValue({
      name: 'Test Clinic',
      phone: '+1234',
      timezone: 'America/New_York',
      verticalPack: 'general',
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('settings.billing')).toBeInTheDocument();
    });
  });

  test('shows notifications quick link', async () => {
    mockApi.get.mockResolvedValue({
      name: 'Test Clinic',
      phone: '+1234',
      timezone: 'America/New_York',
      verticalPack: 'general',
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('settings.notifications')).toBeInTheDocument();
    });
  });

  test('shows booking link card when slug is present', async () => {
    mockApi.get.mockResolvedValue({
      name: 'Test Clinic',
      phone: '+1234',
      timezone: 'America/New_York',
      verticalPack: 'general',
      slug: 'test-clinic',
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('settings.booking_link')).toBeInTheDocument();
      expect(screen.getByText('settings.copy_link')).toBeInTheDocument();
    });
  });

  test('has change password section with translation keys', async () => {
    mockApi.get.mockResolvedValue({
      name: 'Test Clinic',
      phone: '+1234',
      timezone: 'America/New_York',
      verticalPack: 'general',
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('settings.change_password')).toBeInTheDocument();
      expect(screen.getByText('settings.current_password')).toBeInTheDocument();
      expect(screen.getByText('settings.new_password')).toBeInTheDocument();
      expect(screen.getByText('settings.confirm_password')).toBeInTheDocument();
      expect(screen.getByText('settings.update_password')).toBeInTheDocument();
    });
  });
});

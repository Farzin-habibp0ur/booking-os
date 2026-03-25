import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsHub } from './settings-hub';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock auth with configurable role
let mockRole = 'ADMIN';
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: mockRole, businessId: 'b1' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

// Mock cn
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock design-tokens
jest.mock('@/lib/design-tokens', () => ({
  ELEVATION: { card: 'rounded-2xl shadow-soft' },
}));

// Mock lucide-react
jest.mock('lucide-react', () => ({
  ShieldCheck: () => <div data-testid="icon-shield" />,
  Calendar: () => <div data-testid="icon-calendar" />,
  Bell: () => <div data-testid="icon-bell" />,
  Sparkles: () => <div data-testid="icon-sparkles" />,
  Gift: () => <div data-testid="icon-gift" />,
  Clock: () => <div data-testid="icon-clock" />,
  CreditCard: () => <div data-testid="icon-credit" />,
  Palette: () => <div data-testid="icon-palette" />,
  Puzzle: () => <div data-testid="icon-puzzle" />,
  Phone: () => <div data-testid="icon-phone" />,
  Facebook: () => <div data-testid="icon-facebook" />,
  Mail: () => <div data-testid="icon-mail" />,
  Globe: () => <div data-testid="icon-globe" />,
  Radio: () => <div data-testid="icon-radio" />,
  ChevronRight: () => <div data-testid="icon-chevron" />,
}));

describe('SettingsHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'ADMIN';
  });

  it('renders all 13 category cards for ADMIN role', () => {
    render(<SettingsHub />);

    expect(screen.getByTestId('settings-card-account')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-operations')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-communication')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-ai')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-growth')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-channels')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-sms')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-facebook')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-email-channel')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-web-chat')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-integrations')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-billing')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-appearance')).toBeInTheDocument();
  });

  it('renders category labels and descriptions', () => {
    render(<SettingsHub />);

    expect(screen.getByText('Account & Import')).toBeInTheDocument();
    expect(screen.getByText('Calendar & Templates')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();

    expect(
      screen.getByText('Import customers via CSV, export data, and manage profile fields'),
    ).toBeInTheDocument();
  });

  it('navigates to first page when clicking a category card', async () => {
    const user = userEvent.setup();
    render(<SettingsHub />);

    await user.click(screen.getByTestId('settings-card-account'));
    expect(mockPush).toHaveBeenCalledWith('/settings/account');
  });

  it('navigates to /settings/calendar for operations card', async () => {
    const user = userEvent.setup();
    render(<SettingsHub />);

    await user.click(screen.getByTestId('settings-card-operations'));
    expect(mockPush).toHaveBeenCalledWith('/settings/calendar');
  });

  it('navigates to /settings/branding for appearance card', async () => {
    const user = userEvent.setup();
    render(<SettingsHub />);

    await user.click(screen.getByTestId('settings-card-appearance'));
    expect(mockPush).toHaveBeenCalledWith('/settings/branding');
  });

  it('filters cards by AGENT role — shows only account and appearance', () => {
    mockRole = 'AGENT';
    render(<SettingsHub />);

    expect(screen.getByTestId('settings-card-account')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-appearance')).toBeInTheDocument();

    expect(screen.queryByTestId('settings-card-operations')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-card-billing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-card-ai')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-card-growth')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-card-communication')).not.toBeInTheDocument();
  });

  it('filters cards by SERVICE_PROVIDER role — shows only account and appearance', () => {
    mockRole = 'SERVICE_PROVIDER';
    render(<SettingsHub />);

    expect(screen.getByTestId('settings-card-account')).toBeInTheDocument();
    expect(screen.getByTestId('settings-card-appearance')).toBeInTheDocument();

    expect(screen.queryByTestId('settings-card-operations')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-card-billing')).not.toBeInTheDocument();
  });

  it('renders ChevronRight icon on each card', () => {
    render(<SettingsHub />);

    const chevrons = screen.getAllByTestId('icon-chevron');
    expect(chevrons).toHaveLength(14); // 14 cards for ADMIN
  });
});

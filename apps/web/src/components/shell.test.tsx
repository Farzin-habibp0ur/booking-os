import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

// Mock auth
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      name: 'Sarah',
      role: 'ADMIN',
      businessId: 'b1',
      preferences: { mode: 'admin' },
      business: { id: 'b1', name: 'Glow Clinic', slug: 'glow', verticalPack: 'general', defaultLocale: 'en', packConfig: {} },
    },
    logout: jest.fn(),
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: any) => {
    if (key === 'nav.more') return 'More';
    return key;
  }}),
  I18nProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
  }),
  VerticalPackProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
  ToastProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/use-theme', () => ({
  useTheme: () => ({ theme: 'light', toggle: jest.fn() }),
}));

jest.mock('@/components/demo-tour', () => ({
  DemoTourProvider: ({ children }: any) => children,
  useDemoTour: () => ({ state: 'idle', startTour: jest.fn() }),
  TourSpotlight: () => null,
  TourTooltip: () => null,
}));

jest.mock('@/components/command-palette', () => () => null);
jest.mock('@/components/language-picker', () => ({
  LanguagePicker: () => <div>Language</div>,
}));
jest.mock('@/components/error-boundary', () => ({
  ErrorBoundary: ({ children }: any) => children,
}));

// Mock mode system
const mockSetMode = jest.fn();
jest.mock('@/lib/use-mode', () => ({
  ModeProvider: ({ children }: any) => children,
  useMode: () => ({
    mode: 'admin',
    setMode: mockSetMode,
    availableModes: [
      { key: 'admin', labels: { general: 'Admin' }, primaryNavPaths: ['/dashboard', '/reports', '/staff', '/campaigns', '/automations'], allowedRoles: ['ADMIN'] },
      { key: 'agent', labels: { general: 'Agent' }, primaryNavPaths: ['/inbox', '/calendar', '/customers', '/bookings', '/waitlist'], allowedRoles: ['ADMIN', 'AGENT'] },
      { key: 'provider', labels: { general: 'Provider' }, primaryNavPaths: ['/calendar', '/bookings', '/services', '/service-board'], allowedRoles: ['ADMIN', 'SERVICE_PROVIDER'] },
    ],
    modeLabel: 'Admin',
    landingPath: '/dashboard',
    modeDef: {
      key: 'admin',
      primaryNavPaths: ['/dashboard', '/reports', '/staff', '/campaigns', '/automations'],
      secondaryNavPaths: ['/inbox', '/calendar', '/customers', '/bookings', '/services', '/waitlist', '/service-board', '/roi', '/settings'],
      defaultLandingPath: '/dashboard',
    },
  }),
}));

jest.mock('@/components/mode-switcher', () => () => <div data-testid="mode-switcher">ModeSwitcher</div>);

// Mock api for pinned views
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue([]),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Import Shell after all mocks
import { Shell } from './shell';
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

describe('Shell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockResolvedValue([]);
  });

  it('renders the shell with mode switcher', () => {
    render(<Shell><div>Content</div></Shell>);

    expect(screen.getByTestId('mode-switcher')).toBeInTheDocument();
  });

  it('renders primary nav items for admin mode', () => {
    render(<Shell><div>Content</div></Shell>);

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    // Dashboard, Reports, Staff should be visible as primary for admin mode
    expect(within(nav).getByText('nav.dashboard')).toBeInTheDocument();
    expect(within(nav).getByText('nav.reports')).toBeInTheDocument();
    expect(within(nav).getByText('nav.staff')).toBeInTheDocument();
  });

  it('shows "More" toggle button for secondary items', () => {
    render(<Shell><div>Content</div></Shell>);

    const moreBtn = screen.getByText('More');
    expect(moreBtn).toBeInTheDocument();
  });

  it('expands secondary nav when "More" is clicked', async () => {
    render(<Shell><div>Content</div></Shell>);

    const moreBtn = screen.getByText('More');
    await userEvent.click(moreBtn);

    // After expanding, secondary items should be visible
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByText('nav.inbox')).toBeInTheDocument();
    expect(within(nav).getByText('nav.settings')).toBeInTheDocument();
  });

  it('renders main content', () => {
    render(<Shell><div>Test Content</div></Shell>);

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders sidebar with business name', () => {
    render(<Shell><div>Content</div></Shell>);

    expect(screen.getAllByText('Glow Clinic').length).toBeGreaterThan(0);
  });

  it('fetches pinned views on mount', () => {
    render(<Shell><div>Content</div></Shell>);

    expect(mockApi.get).toHaveBeenCalledWith('/saved-views/pinned');
  });

  it('renders pinned views section when views exist', async () => {
    mockApi.get.mockResolvedValue([
      { id: 'v1', name: 'Pending Deposits', page: 'bookings', icon: 'flag', isPinned: true },
      { id: 'v2', name: 'Overdue Replies', page: 'inbox', icon: 'bell', isPinned: true },
    ]);

    render(<Shell><div>Content</div></Shell>);

    expect(await screen.findByText('Pending Deposits')).toBeInTheDocument();
    expect(screen.getByText('Overdue Replies')).toBeInTheDocument();
    expect(screen.getByTestId('pinned-views-section')).toBeInTheDocument();
  });

  it('does not render pinned views section when no views', async () => {
    mockApi.get.mockResolvedValue([]);

    render(<Shell><div>Content</div></Shell>);

    // Wait for mount to settle
    await screen.findByText('Content');
    expect(screen.queryByTestId('pinned-views-section')).not.toBeInTheDocument();
  });

  it('renders pinned view as link to page with viewId', async () => {
    mockApi.get.mockResolvedValue([
      { id: 'v1', name: 'Pending Deposits', page: 'bookings', icon: 'flag', isPinned: true },
    ]);

    render(<Shell><div>Content</div></Shell>);

    const link = await screen.findByText('Pending Deposits');
    expect(link.closest('a')).toHaveAttribute('href', '/bookings?viewId=v1');
  });
});

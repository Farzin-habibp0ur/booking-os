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
      business: {
        id: 'b1',
        name: 'Glow Clinic',
        slug: 'glow',
        verticalPack: 'general',
        defaultLocale: 'en',
        packConfig: {},
      },
    },
    logout: jest.fn(),
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => {
      if (key === 'nav.more') return 'More';
      return key;
    },
  }),
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
      {
        key: 'admin',
        labels: { general: 'Admin' },
        primaryNavPaths: ['/dashboard', '/reports', '/staff', '/campaigns', '/automations'],
        allowedRoles: ['ADMIN'],
      },
      {
        key: 'agent',
        labels: { general: 'Agent' },
        primaryNavPaths: ['/inbox', '/calendar', '/customers', '/bookings', '/waitlist'],
        allowedRoles: ['ADMIN', 'AGENT'],
      },
      {
        key: 'provider',
        labels: { general: 'Provider' },
        primaryNavPaths: ['/calendar', '/bookings', '/services', '/service-board'],
        allowedRoles: ['ADMIN', 'SERVICE_PROVIDER'],
      },
    ],
    modeLabel: 'Admin',
    landingPath: '/dashboard',
    modeDef: {
      key: 'admin',
      sections: {
        workspace: ['/dashboard', '/inbox', '/calendar', '/customers', '/bookings'],
        tools: [
          '/services',
          '/campaigns',
          '/automations',
          '/marketing/queue',
          '/marketing/agents',
          '/marketing/sequences',
          '/marketing/rejection-analytics',
          '/waitlist',
          '/service-board',
        ],
        insights: [
          '/reports',
          '/reports/monthly-review',
          '/roi',
          '/ai',
          '/ai/actions',
          '/ai/agents',
          '/ai/performance',
        ],
      },
      defaultLandingPath: '/dashboard',
    },
  }),
}));

jest.mock('@/components/mode-switcher', () => () => (
  <div data-testid="mode-switcher">ModeSwitcher</div>
));

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
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    expect(screen.getByTestId('mode-switcher')).toBeInTheDocument();
  });

  it('renders workspace nav items for admin mode', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    // Workspace section items: Dashboard, Inbox, Calendar, Customers, Bookings
    expect(within(nav).getByText('nav.dashboard')).toBeInTheDocument();
    expect(within(nav).getByText('nav.inbox')).toBeInTheDocument();
    expect(within(nav).getByText('nav.calendar')).toBeInTheDocument();
  });

  it('shows "More" button in mobile tab bar', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const moreBtn = screen.getByRole('tab', { name: 'More options' });
    expect(moreBtn).toBeInTheDocument();
  });

  it('opens more sheet when "More" button is clicked on mobile', async () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    // Settings already exists in the sidebar
    const beforeCount = screen.getAllByText('nav.settings').length;

    const moreBtn = screen.getByRole('tab', { name: 'More options' });
    await userEvent.click(moreBtn);

    // After opening, the "More" sheet adds another Settings link
    const afterCount = screen.getAllByText('nav.settings').length;
    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  it('renders main content', () => {
    render(
      <Shell>
        <div>Test Content</div>
      </Shell>,
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders sidebar with business name', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    expect(screen.getAllByText('Glow Clinic').length).toBeGreaterThan(0);
  });

  it('fetches pinned views on mount', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    expect(mockApi.get).toHaveBeenCalledWith('/saved-views/pinned');
  });

  it('renders pinned views section when views exist', async () => {
    mockApi.get.mockResolvedValue([
      { id: 'v1', name: 'Pending Deposits', page: 'bookings', icon: 'flag', isPinned: true },
      { id: 'v2', name: 'Overdue Replies', page: 'inbox', icon: 'bell', isPinned: true },
    ]);

    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    expect(await screen.findByText('Pending Deposits')).toBeInTheDocument();
    expect(screen.getByText('Overdue Replies')).toBeInTheDocument();
    expect(screen.getByTestId('pinned-views-section')).toBeInTheDocument();
  });

  it('does not render pinned views section when no views', async () => {
    mockApi.get.mockResolvedValue([]);

    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    // Wait for mount to settle
    await screen.findByText('Content');
    expect(screen.queryByTestId('pinned-views-section')).not.toBeInTheDocument();
  });

  it('renders section labels for workspace, tools, and insights', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    // t() mock returns the key, so section labels render as the i18n keys
    expect(within(nav).getByText('nav.section_workspace')).toBeInTheDocument();
    expect(within(nav).getByText('nav.section_tools')).toBeInTheDocument();
    expect(within(nav).getByText('nav.section_insights')).toBeInTheDocument();
  });

  it('section labels use nav-section-label class', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const workspaceLabel = within(nav).getByText('nav.section_workspace');
    expect(workspaceLabel.className).toContain('nav-section-label');
  });

  it('renders Settings in footer area, not in main nav', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    // Settings should NOT be inside the main nav element
    expect(within(nav).queryByText('nav.settings')).not.toBeInTheDocument();

    // Settings should exist in the sidebar footer area
    const sidebar = screen.getByRole('complementary') || document.querySelector('aside');
    expect(screen.getAllByText('nav.settings').length).toBeGreaterThan(0);
  });

  it('does not have a "More" toggle in the sidebar (only in mobile tab bar)', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    // No "More" or "Show More" button inside the sidebar nav
    expect(within(nav).queryByText('More')).not.toBeInTheDocument();
    expect(within(nav).queryByText(/show more/i)).not.toBeInTheDocument();
  });

  it('renders Content Queue nav link pointing to /marketing/queue', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const link = within(nav).getByText('Content Queue');
    expect(link.closest('a')).toHaveAttribute('href', '/marketing/queue');
  });

  it('renders Marketing Agents nav link pointing to /marketing/agents', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const link = within(nav).getByText('Marketing Agents');
    expect(link.closest('a')).toHaveAttribute('href', '/marketing/agents');
  });

  it('renders AI sub-route nav links', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByText('Action Triage')).toBeInTheDocument();
    expect(within(nav).getByText('Agent Status')).toBeInTheDocument();
    expect(within(nav).getByText('Performance')).toBeInTheDocument();
  });

  it('renders Rejection Analytics nav link', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const link = within(nav).getByText('Rejection Analytics');
    expect(link.closest('a')).toHaveAttribute('href', '/marketing/rejection-analytics');
  });

  it('renders pinned view as link to page with viewId', async () => {
    mockApi.get.mockResolvedValue([
      { id: 'v1', name: 'Pending Deposits', page: 'bookings', icon: 'flag', isPinned: true },
    ]);

    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const link = await screen.findByText('Pending Deposits');
    expect(link.closest('a')).toHaveAttribute('href', '/bookings?viewId=v1');
  });
});

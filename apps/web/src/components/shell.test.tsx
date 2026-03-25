/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock ResizeObserver for nav scroll tracking
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock next/navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
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
    t: (key, params) => {
      if (key === 'nav.more') return 'More';
      if (key === 'nav.home') return 'Home';
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
        primaryNavPaths: ['/dashboard', '/reports', '/staff', '/marketing'],
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
        workspace: ['/dashboard', '/inbox', '/calendar', '/customers', '/bookings', '/waitlist'],
        tools: ['/services', '/marketing', '/service-board'],
        insights: ['/reports', '/reports/monthly-review', '/roi'],
        aiAgents: ['/ai', '/ai/agents', '/ai/actions', '/ai/performance'],
        overflow: {
          tools: [],
          insights: ['/reports/monthly-review', '/roi'],
          aiAgents: ['/ai/agents', '/ai/actions', '/ai/performance'],
        },
      },
      defaultLandingPath: '/dashboard',
      allowedRoles: ['ADMIN'],
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
    localStorage.clear();
    sessionStorage.clear();
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

  it('mobile tab bar shows mode-appropriate tabs for admin', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const mobileNav = screen.getByRole('tablist', { name: 'Mobile navigation' });
    // Admin mode: Inbox, Calendar, Customers, Home + More
    expect(within(mobileNav).getByText('nav.inbox')).toBeInTheDocument();
    expect(within(mobileNav).getByText('nav.calendar')).toBeInTheDocument();
    expect(within(mobileNav).getByText('nav.customers')).toBeInTheDocument();
    expect(within(mobileNav).getByText('Home')).toBeInTheDocument();
  });

  it('mobile tab bar has exactly 4 link tabs plus More button', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const mobileNav = screen.getByRole('tablist', { name: 'Mobile navigation' });
    const tabs = within(mobileNav).getAllByRole('tab');
    // 4 link tabs + 1 More button = 5
    expect(tabs).toHaveLength(5);
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

  it('renders section labels for workspace, tools, insights, and ai agents', () => {
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
    expect(within(nav).getByText('nav.section_ai_agents')).toBeInTheDocument();
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

  it('renders "More" toggle in the sidebar when overflow items exist', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const toggle = screen.getByTestId('sidebar-more-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands overflow section when "More" toggle is clicked', async () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const toggle = screen.getByTestId('sidebar-more-toggle');
    expect(screen.queryByTestId('sidebar-overflow-items')).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('sidebar-overflow-items')).toBeInTheDocument();
  });

  it('overflow section contains items not in primary nav', async () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    // Marketing should be in primary nav (not overflow)
    expect(within(nav).getByText('nav.marketing')).toBeInTheDocument();

    // Click More to expand — overflow sections still have insights/AI items
    await userEvent.click(screen.getByTestId('sidebar-more-toggle'));

    expect(screen.getByTestId('sidebar-overflow-items')).toBeInTheDocument();
  });

  it('does not render marketing nav links (Content Queue, Marketing Agents, etc.)', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).queryByText('Content Queue')).not.toBeInTheDocument();
    expect(within(nav).queryByText('Marketing Agents')).not.toBeInTheDocument();
    expect(within(nav).queryByText('Email Sequences')).not.toBeInTheDocument();
    expect(within(nav).queryByText('Rejection Analytics')).not.toBeInTheDocument();
  });

  it('renders AI sub-route nav links in overflow when expanded', async () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    // AI sub-routes are overflow — hidden by default (t() returns keys)
    expect(within(nav).queryByText('nav.ai_actions')).not.toBeInTheDocument();
    expect(within(nav).queryByText('nav.ai_agents')).not.toBeInTheDocument();
    expect(within(nav).queryByText('nav.ai_performance')).not.toBeInTheDocument();

    // Expand overflow
    await userEvent.click(screen.getByTestId('sidebar-more-toggle'));

    expect(within(nav).getByText('nav.ai_actions')).toBeInTheDocument();
    expect(within(nav).getByText('nav.ai_agents')).toBeInTheDocument();
    expect(within(nav).getByText('nav.ai_performance')).toBeInTheDocument();
  });

  it('nav container has min-h-0 to allow flex shrinking on short viewports', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    // The nav's parent wrapper must have min-h-0 for flex shrinking
    const navWrapper = nav.parentElement;
    expect(navWrapper?.className).toContain('min-h-0');
  });

  it('nav element has overflow-y-auto for scrolling', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav.className).toContain('overflow-y-auto');
  });

  it('renders primary nav items in tools, insights, and AI sections', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    // Primary TOOLS items (not overflow)
    expect(within(nav).getByText('nav.services')).toBeInTheDocument();
    // Primary INSIGHTS item
    expect(within(nav).getByText('nav.reports')).toBeInTheDocument();
    // Primary AI item (t() returns key)
    expect(within(nav).getByText('nav.ai')).toBeInTheDocument();
    // Marketing should be in primary tools
    expect(within(nav).getByText('nav.marketing')).toBeInTheDocument();
  });

  it('sidebar footer stays outside scrollable nav', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    // Settings and logout must be OUTSIDE the nav
    expect(within(nav).queryByText('nav.logout')).not.toBeInTheDocument();
    expect(within(nav).queryByText('Start Tour')).not.toBeInTheDocument();
  });

  it('does not redirect admin mode on login (landingPath is /dashboard)', () => {
    sessionStorage.setItem('booking-os-login-redirect', '1');

    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    // Admin landingPath is /dashboard, pathname is /dashboard — no redirect
    expect(mockReplace).not.toHaveBeenCalled();
    // Flag should be consumed
    expect(sessionStorage.getItem('booking-os-login-redirect')).toBeNull();
  });
});

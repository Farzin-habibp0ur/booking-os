/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { render, screen, within } from '@testing-library/react';

// Mock ResizeObserver
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/calendar',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => ({ children, href, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

// Mock auth — ADMIN role user viewing in Provider mode
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      name: 'Sarah',
      role: 'ADMIN',
      businessId: 'b1',
      preferences: { mode: 'provider' },
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
  AuthProvider: ({ children }) => children,
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key, params) => {
      if (key === 'nav.more') return 'More';
      if (key === 'nav.home') return 'Home';
      return key;
    },
  }),
  I18nProvider: ({ children }) => children,
}));

jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
  }),
  VerticalPackProvider: ({ children }) => children,
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
  ToastProvider: ({ children }) => children,
}));

jest.mock('@/lib/use-theme', () => ({
  useTheme: () => ({ theme: 'light', toggle: jest.fn() }),
}));

jest.mock('@/components/demo-tour', () => ({
  DemoTourProvider: ({ children }) => children,
  useDemoTour: () => ({ state: 'idle', startTour: jest.fn() }),
  TourSpotlight: () => null,
  TourTooltip: () => null,
}));

jest.mock('@/components/command-palette', () => () => null);
jest.mock('@/components/language-picker', () => ({
  LanguagePicker: () => <div>Language</div>,
}));
jest.mock('@/components/error-boundary', () => ({
  ErrorBoundary: ({ children }) => children,
}));

// Mock mode system — PROVIDER mode (ADMIN user switching to provider view)
jest.mock('@/lib/use-mode', () => ({
  ModeProvider: ({ children }) => children,
  useMode: () => ({
    mode: 'provider',
    setMode: jest.fn(),
    availableModes: [
      {
        key: 'provider',
        labels: { general: 'Provider' },
        primaryNavPaths: ['/calendar', '/bookings', '/services', '/service-board', '/dashboard'],
        allowedRoles: ['ADMIN', 'SERVICE_PROVIDER'],
      },
    ],
    modeLabel: 'Provider',
    landingPath: '/calendar',
    modeDef: {
      key: 'provider',
      sections: {
        workspace: ['/calendar', '/bookings'],
        tools: ['/services', '/service-board'],
        insights: ['/dashboard'],
      },
      defaultLandingPath: '/calendar',
    },
  }),
}));

jest.mock('@/components/mode-switcher', () => () => (
  <div data-testid="mode-switcher">ModeSwitcher</div>
));

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue([]),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

import { Shell } from './shell';

describe('Shell — ADMIN user in Provider mode sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('does NOT render Inbox in sidebar for provider mode', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).queryByText('nav.inbox')).not.toBeInTheDocument();
  });

  it('does NOT render Staff in sidebar for provider mode', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).queryByText('nav.staff')).not.toBeInTheDocument();
  });

  it('does NOT render Campaigns in sidebar for provider mode', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).queryByText('nav.campaigns')).not.toBeInTheDocument();
  });

  it('does NOT render Waitlist in sidebar for provider mode', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).queryByText('nav.waitlist')).not.toBeInTheDocument();
  });

  it('renders Calendar in sidebar for provider mode', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByText('nav.calendar')).toBeInTheDocument();
  });

  it('renders Services in sidebar for provider mode', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByText('nav.services')).toBeInTheDocument();
  });

  it('renders Dashboard in sidebar for provider mode', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByText('nav.dashboard')).toBeInTheDocument();
  });

  it('does not show "More" toggle since provider has no overflow', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    expect(screen.queryByTestId('sidebar-more-toggle')).not.toBeInTheDocument();
  });
});

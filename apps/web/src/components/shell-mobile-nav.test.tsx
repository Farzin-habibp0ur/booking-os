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
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/calendar',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => ({ children, href, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

// Mock auth — SERVICE_PROVIDER role
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: {
      id: '2',
      name: 'Dr. Kim',
      role: 'SERVICE_PROVIDER',
      businessId: 'b1',
      preferences: { mode: 'provider' },
      business: {
        id: 'b1',
        name: 'Glow Clinic',
        slug: 'glow',
        verticalPack: 'aesthetic',
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
      if (key === 'nav.bookings') return params && params.entity ? params.entity + 's' : 'Bookings';
      return key;
    },
  }),
  I18nProvider: ({ children }) => children,
}));

jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'aesthetic',
    labels: { customer: 'Client', booking: 'Booking', service: 'Treatment' },
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

// Mock mode system — PROVIDER mode
jest.mock('@/lib/use-mode', () => ({
  ModeProvider: ({ children }) => children,
  useMode: () => ({
    mode: 'provider',
    setMode: jest.fn(),
    availableModes: [
      {
        key: 'provider',
        labels: { aesthetic: 'Provider' },
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
      allowedRoles: ['ADMIN', 'SERVICE_PROVIDER'],
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

describe('Shell — provider mobile nav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('does NOT show Inbox tab for SERVICE_PROVIDER', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const mobileNav = screen.getByRole('tablist', { name: 'Mobile navigation' });
    expect(within(mobileNav).queryByText('nav.inbox')).not.toBeInTheDocument();
  });

  it('shows Calendar, Bookings, Home, and More for provider mode', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const mobileNav = screen.getByRole('tablist', { name: 'Mobile navigation' });
    expect(within(mobileNav).getByText('nav.calendar')).toBeInTheDocument();
    expect(within(mobileNav).getByText('Bookings')).toBeInTheDocument();
    expect(within(mobileNav).getByText('Home')).toBeInTheDocument();
    expect(within(mobileNav).getByText('More')).toBeInTheDocument();
  });

  it('does NOT show Customers tab for SERVICE_PROVIDER', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const mobileNav = screen.getByRole('tablist', { name: 'Mobile navigation' });
    expect(within(mobileNav).queryByText('Clients')).not.toBeInTheDocument();
    expect(within(mobileNav).queryByText('nav.customers')).not.toBeInTheDocument();
  });

  it('provider mobile tab bar has fewer link tabs than admin', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    const mobileNav = screen.getByRole('tablist', { name: 'Mobile navigation' });
    const tabs = within(mobileNav).getAllByRole('tab');
    // Calendar, Bookings, Home + More = 4 (provider has fewer workspace paths)
    expect(tabs.length).toBeLessThanOrEqual(5);
    expect(tabs.length).toBeGreaterThanOrEqual(4);
  });
});

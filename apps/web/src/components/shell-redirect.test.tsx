/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { render, screen } from '@testing-library/react';

// Mock ResizeObserver
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock localStorage + sessionStorage
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

const sessionStorageMock = (() => {
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
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/dashboard', // landing on /dashboard after login
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => ({ children, href, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: {
      id: '3',
      name: 'Jane',
      role: 'AGENT',
      businessId: 'b1',
      preferences: { mode: 'agent' },
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
      if (key === 'nav.home') return 'Home';
      if (key === 'nav.more') return 'More';
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

// Agent mode — landingPath is /inbox (not /dashboard)
jest.mock('@/lib/use-mode', () => ({
  ModeProvider: ({ children }) => children,
  useMode: () => ({
    mode: 'agent',
    setMode: jest.fn(),
    availableModes: [],
    modeLabel: 'Reception',
    landingPath: '/inbox',
    modeDef: {
      key: 'agent',
      sections: {
        workspace: ['/inbox', '/calendar', '/customers', '/bookings', '/waitlist'],
        tools: ['/services'],
        insights: ['/dashboard', '/reports'],
      },
      defaultLandingPath: '/inbox',
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

describe('Shell — post-login redirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('redirects agent from /dashboard to /inbox after login', () => {
    sessionStorage.setItem('booking-os-login-redirect', '1');

    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    expect(mockReplace).toHaveBeenCalledWith('/inbox');
    expect(sessionStorage.getItem('booking-os-login-redirect')).toBeNull();
  });

  it('does not redirect when no login flag is set', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('consumes the flag even on first render', () => {
    sessionStorage.setItem('booking-os-login-redirect', '1');

    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    // Flag consumed
    expect(sessionStorage.getItem('booking-os-login-redirect')).toBeNull();
  });
});

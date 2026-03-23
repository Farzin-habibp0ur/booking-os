/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { render } from '@testing-library/react';

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

const mockReplace = jest.fn();
const mockPush = jest.fn();

// Pathname: /inbox — not in provider sections
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/inbox',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => ({ children, href, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

// ADMIN user in provider mode
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
    t: (key) => key,
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

// Provider mode — /inbox is NOT in provider sections
jest.mock('@/lib/use-mode', () => ({
  ModeProvider: ({ children }) => children,
  useMode: () => ({
    mode: 'provider',
    setMode: jest.fn(),
    availableModes: [],
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

describe('Shell — mode redirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('redirects to defaultLandingPath when pathname is not allowed for current mode', () => {
    render(
      <Shell>
        <div>Content</div>
      </Shell>,
    );

    // /inbox is not in provider sections, so should redirect to /calendar
    expect(mockReplace).toHaveBeenCalledWith('/calendar');
  });
});

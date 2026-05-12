import { render, screen, act } from '@testing-library/react';
import { InstallPrompt } from './install-prompt';

// Store event listeners so we can trigger them in tests
let beforeInstallPromptHandler: ((e: Event) => void) | null = null;

beforeEach(() => {
  localStorage.clear();
  beforeInstallPromptHandler = null;

  jest.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
    if (event === 'beforeinstallprompt') {
      beforeInstallPromptHandler = handler as (e: Event) => void;
    }
  });

  jest.spyOn(window, 'removeEventListener').mockImplementation(() => {});

  // Default: non-iOS, non-standalone
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
    configurable: true,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('InstallPrompt — Phase 6 (Capacitor mobile deferred)', () => {
  it('renders nothing on initial mount (suppressed during AI Front Desk pilot)', () => {
    const { container } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('stays suppressed even after beforeinstallprompt fires', () => {
    render(<InstallPrompt />);

    act(() => {
      const event = new Event('beforeinstallprompt');
      (event as any).preventDefault = jest.fn();
      (event as any).prompt = jest.fn().mockResolvedValue(undefined);
      (event as any).userChoice = Promise.resolve({ outcome: 'dismissed' });
      beforeInstallPromptHandler?.(event);
    });

    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument();
    expect(screen.queryByTestId('install-button')).not.toBeInTheDocument();
  });

  it('stays suppressed on iOS Safari', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    Object.defineProperty(window.navigator, 'standalone', {
      value: false,
      configurable: true,
    });

    render(<InstallPrompt />);

    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument();
    expect(screen.queryByText(/Add to Home Screen/)).not.toBeInTheDocument();
  });

  it('does not render even when previously dismissed flag is absent', () => {
    expect(localStorage.getItem('pwa-install-dismissed')).toBeNull();
    const { container } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe('');
  });
});

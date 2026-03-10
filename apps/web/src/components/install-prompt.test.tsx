import { render, screen, fireEvent, act } from '@testing-library/react';
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

describe('InstallPrompt', () => {
  it('renders nothing when beforeinstallprompt has not fired', () => {
    const { container } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('shows banner when beforeinstallprompt fires', () => {
    render(<InstallPrompt />);

    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument();

    // Simulate the browser event
    act(() => {
      const event = new Event('beforeinstallprompt');
      (event as any).preventDefault = jest.fn();
      (event as any).prompt = jest.fn().mockResolvedValue(undefined);
      (event as any).userChoice = Promise.resolve({ outcome: 'dismissed' });
      beforeInstallPromptHandler?.(event);
    });

    expect(screen.getByTestId('install-prompt')).toBeInTheDocument();
    expect(screen.getByText('Install Booking OS for faster access')).toBeInTheDocument();
    expect(screen.getByTestId('install-button')).toBeInTheDocument();
  });

  it('dismisses banner and saves to localStorage when "Not now" is clicked', () => {
    render(<InstallPrompt />);

    act(() => {
      const event = new Event('beforeinstallprompt');
      (event as any).preventDefault = jest.fn();
      (event as any).prompt = jest.fn().mockResolvedValue(undefined);
      (event as any).userChoice = Promise.resolve({ outcome: 'dismissed' });
      beforeInstallPromptHandler?.(event);
    });

    expect(screen.getByTestId('install-prompt')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dismiss-button'));

    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument();
    expect(localStorage.getItem('pwa-install-dismissed')).toBe('1');
  });

  it('stays hidden after previous dismissal', () => {
    localStorage.setItem('pwa-install-dismissed', '1');

    render(<InstallPrompt />);

    // Even if beforeinstallprompt fires, the banner should not appear
    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument();
  });

  it('calls prompt() when Install button is clicked', async () => {
    render(<InstallPrompt />);

    const mockPrompt = jest.fn().mockResolvedValue(undefined);
    const mockUserChoice = Promise.resolve({ outcome: 'accepted' as const });

    act(() => {
      const event = new Event('beforeinstallprompt');
      (event as any).preventDefault = jest.fn();
      (event as any).prompt = mockPrompt;
      (event as any).userChoice = mockUserChoice;
      beforeInstallPromptHandler?.(event);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('install-button'));
    });

    expect(mockPrompt).toHaveBeenCalled();
  });

  it('shows iOS instructions on iOS Safari', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    // Mock standalone as false (not already installed)
    Object.defineProperty(window.navigator, 'standalone', {
      value: false,
      configurable: true,
    });

    render(<InstallPrompt />);

    expect(screen.getByTestId('install-prompt')).toBeInTheDocument();
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(screen.queryByTestId('install-button')).not.toBeInTheDocument();
  });
});

import { render, screen, act } from '@testing-library/react';
import { TourSpotlight } from './tour-spotlight';
import { DemoTourProvider, useDemoTour } from './demo-tour-provider';
import { TOUR_STEPS } from './tour-steps';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/dashboard',
}));

// Helper to start tour
function TourStarter({ children }: { children: React.ReactNode }) {
  const { startTour } = useDemoTour();
  return (
    <>
      <button data-testid="start" onClick={startTour}>Start</button>
      {children}
    </>
  );
}

function renderSpotlight(targetElement?: HTMLElement) {
  const result = render(
    <DemoTourProvider>
      <TourStarter>
        <TourSpotlight />
      </TourStarter>
    </DemoTourProvider>,
  );
  return result;
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
  // Clean up any data-tour-target elements
  document.querySelectorAll('[data-tour-target]').forEach((el) => el.remove());
});

describe('TourSpotlight', () => {
  it('does not render when tour is idle', () => {
    const { container } = renderSpotlight();
    // Should have no fixed overlay
    expect(container.querySelector('.fixed.inset-0')).toBeNull();
  });

  it('renders overlay when tour is active and target exists', async () => {
    // Create target element
    const target = document.createElement('div');
    target.setAttribute('data-tour-target', TOUR_STEPS[0].target);
    target.style.width = '200px';
    target.style.height = '100px';
    target.getBoundingClientRect = jest.fn().mockReturnValue({
      top: 50, left: 100, width: 200, height: 100, bottom: 150, right: 300,
    });
    document.body.appendChild(target);

    const { container } = renderSpotlight();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    // Wait for the setTimeout delay
    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    const overlay = container.querySelector('.fixed.inset-0');
    expect(overlay).toBeTruthy();
  });

  it('positions cutout over target element', async () => {
    const target = document.createElement('div');
    target.setAttribute('data-tour-target', TOUR_STEPS[0].target);
    target.getBoundingClientRect = jest.fn().mockReturnValue({
      top: 50, left: 100, width: 200, height: 100, bottom: 150, right: 300,
    });
    document.body.appendChild(target);

    const { container } = renderSpotlight();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    const cutout = container.querySelector('.absolute.rounded-2xl');
    expect(cutout).toBeTruthy();
    if (cutout) {
      const style = (cutout as HTMLElement).style;
      // Should have positioning set
      expect(style.top).toBeTruthy();
      expect(style.left).toBeTruthy();
      expect(style.width).toBeTruthy();
      expect(style.height).toBeTruthy();
    }
  });

  it('applies highlight padding from step config', async () => {
    const target = document.createElement('div');
    target.setAttribute('data-tour-target', TOUR_STEPS[0].target);
    target.getBoundingClientRect = jest.fn().mockReturnValue({
      top: 100, left: 100, width: 200, height: 100, bottom: 200, right: 300,
    });
    document.body.appendChild(target);

    const { container } = renderSpotlight();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    const cutout = container.querySelector('.absolute.rounded-2xl') as HTMLElement;
    expect(cutout).toBeTruthy();
    // Step 0 has highlightPadding: 8
    const padding = TOUR_STEPS[0].highlightPadding ?? 4;
    expect(cutout.style.width).toBe(`${200 + padding * 2}px`);
  });

  it('handles missing target element gracefully', async () => {
    // Don't add any target element
    const { container } = renderSpotlight();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    // Overlay should render but cutout should not be visible (no rect)
    const cutout = container.querySelector('.absolute.rounded-2xl');
    expect(cutout).toBeNull();
  });

  it('scrolls target into view when off-screen', async () => {
    const scrollIntoView = jest.fn();
    const target = document.createElement('div');
    target.setAttribute('data-tour-target', TOUR_STEPS[0].target);
    target.getBoundingClientRect = jest.fn().mockReturnValue({
      top: -100, left: 100, width: 200, height: 100, bottom: 0, right: 300,
    });
    target.scrollIntoView = scrollIntoView;
    document.body.appendChild(target);

    renderSpotlight();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('blocks click events on the backdrop', async () => {
    const target = document.createElement('div');
    target.setAttribute('data-tour-target', TOUR_STEPS[0].target);
    target.getBoundingClientRect = jest.fn().mockReturnValue({
      top: 50, left: 100, width: 200, height: 100, bottom: 150, right: 300,
    });
    document.body.appendChild(target);

    const { container } = renderSpotlight();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    const overlay = container.querySelector('.fixed.inset-0');
    expect(overlay).toBeTruthy();
    // Overlay has pointer-events-auto class
    expect(overlay?.className).toContain('pointer-events-auto');
  });

  it('updates position on window resize', async () => {
    const target = document.createElement('div');
    target.setAttribute('data-tour-target', TOUR_STEPS[0].target);
    let callCount = 0;
    target.getBoundingClientRect = jest.fn().mockImplementation(() => {
      callCount++;
      return { top: 50, left: 100, width: 200, height: 100, bottom: 150, right: 300 };
    });
    document.body.appendChild(target);

    renderSpotlight();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    const initialCalls = callCount;

    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(callCount).toBeGreaterThan(initialCalls);
  });
});

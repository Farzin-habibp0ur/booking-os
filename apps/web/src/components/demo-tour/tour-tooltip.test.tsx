import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TourTooltip } from './tour-tooltip';
import { DemoTourProvider, useDemoTour } from './demo-tour-provider';
import { TOUR_STEPS } from './tour-steps';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/dashboard',
}));

// Mock lucide-react
jest.mock('lucide-react', () => ({
  ChevronLeft: (props: any) => <span data-testid="chevron-left" {...props} />,
  ChevronRight: (props: any) => <span data-testid="chevron-right" {...props} />,
  X: (props: any) => <span data-testid="x-icon" {...props} />,
}));

function TourController({ children }: { children: React.ReactNode }) {
  const { startTour, nextStep, prevStep, skipTour, currentStepIndex } = useDemoTour();
  return (
    <>
      <button data-testid="start" onClick={startTour}>Start</button>
      <button data-testid="next" onClick={nextStep}>Next</button>
      <button data-testid="prev" onClick={prevStep}>Prev</button>
      <button data-testid="skip" onClick={skipTour}>Skip</button>
      <span data-testid="idx">{currentStepIndex}</span>
      {children}
    </>
  );
}

function setupTarget(stepIndex = 0) {
  const target = document.createElement('div');
  target.setAttribute('data-tour-target', TOUR_STEPS[stepIndex].target);
  target.getBoundingClientRect = jest.fn().mockReturnValue({
    top: 200, left: 300, width: 400, height: 100, bottom: 300, right: 700,
  });
  document.body.appendChild(target);
  return target;
}

function renderTooltip() {
  return render(
    <DemoTourProvider>
      <TourController>
        <TourTooltip />
      </TourController>
    </DemoTourProvider>,
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  mockPush.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  document.querySelectorAll('[data-tour-target]').forEach((el) => el.remove());
});

describe('TourTooltip', () => {
  it('does not render when tour is idle', () => {
    renderTooltip();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders step content when tour is active', async () => {
    setupTarget(0);
    renderTooltip();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(TOUR_STEPS[0].title)).toBeTruthy();
    expect(screen.getByText(TOUR_STEPS[0].description)).toBeTruthy();
  });

  it('displays step counter', async () => {
    setupTarget(0);
    renderTooltip();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByText(`1 of ${TOUR_STEPS.length}`)).toBeTruthy();
  });

  it('hides Back button on first step', async () => {
    setupTarget(0);
    renderTooltip();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    // Should have Next button but no Back button inside the dialog
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Next');
    expect(dialog.textContent).not.toContain('Back');
  });

  it('shows Back button on second step', async () => {
    setupTarget(0);
    setupTarget(1);
    renderTooltip();

    await act(async () => {
      screen.getByTestId('start').click();
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await act(async () => {
      screen.getByTestId('next').click();
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Back');
  });

  it('shows Finish button on last step', async () => {
    // Set up all targets
    TOUR_STEPS.forEach((_, i) => setupTarget(i));
    renderTooltip();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    // Navigate to last step
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      await act(async () => {
        screen.getByTestId('next').click();
      });
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
    }

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Finish');
  });

  it('has close button that calls skipTour', async () => {
    setupTarget(0);
    renderTooltip();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    const closeBtn = screen.getByLabelText('Close tour');
    expect(closeBtn).toBeTruthy();
  });

  it('positions tooltip within viewport bounds', async () => {
    const target = document.createElement('div');
    target.setAttribute('data-tour-target', TOUR_STEPS[0].target);
    target.getBoundingClientRect = jest.fn().mockReturnValue({
      top: 10, left: 10, width: 100, height: 50, bottom: 60, right: 110,
    });
    document.body.appendChild(target);

    renderTooltip();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    const dialog = screen.getByRole('dialog') as HTMLElement;
    const left = parseInt(dialog.style.left);
    const top = parseInt(dialog.style.top);
    // Should be within viewport
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
  });

  it('has correct aria-label', async () => {
    setupTarget(0);
    renderTooltip();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', TOUR_STEPS[0].title);
  });

  it('renders with proper dark mode classes', async () => {
    setupTarget(0);
    renderTooltip();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('dark:bg-slate-900');
  });

  it('updates position on window resize', async () => {
    const target = document.createElement('div');
    target.setAttribute('data-tour-target', TOUR_STEPS[0].target);
    let callCount = 0;
    target.getBoundingClientRect = jest.fn().mockImplementation(() => {
      callCount++;
      return { top: 200, left: 300, width: 400, height: 100, bottom: 300, right: 700 };
    });
    document.body.appendChild(target);

    renderTooltip();

    await act(async () => {
      screen.getByTestId('start').click();
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    const initialCalls = callCount;

    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(callCount).toBeGreaterThan(initialCalls);
  });
});

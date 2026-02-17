import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoTourProvider, useDemoTour } from './demo-tour-provider';
import { TOUR_STEPS } from './tour-steps';

// Mock next/navigation
const mockPush = jest.fn();
let mockPathname = '/dashboard';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

// Helper component to expose tour context
function TourConsumer() {
  const tour = useDemoTour();
  return (
    <div>
      <span data-testid="state">{tour.state}</span>
      <span data-testid="step">{tour.currentStepIndex}</span>
      <span data-testid="total">{tour.totalSteps}</span>
      <span data-testid="step-id">{tour.currentStep?.id ?? 'none'}</span>
      <button data-testid="start" onClick={tour.startTour}>
        Start
      </button>
      <button data-testid="next" onClick={tour.nextStep}>
        Next
      </button>
      <button data-testid="prev" onClick={tour.prevStep}>
        Prev
      </button>
      <button data-testid="skip" onClick={tour.skipTour}>
        Skip
      </button>
      <button data-testid="pause" onClick={tour.pauseTour}>
        Pause
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <DemoTourProvider>
      <TourConsumer />
    </DemoTourProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockPathname = '/dashboard';
  localStorage.clear();
});

describe('DemoTourProvider', () => {
  it('starts in idle state', () => {
    renderWithProvider();
    expect(screen.getByTestId('state')).toHaveTextContent('idle');
    expect(screen.getByTestId('step-id')).toHaveTextContent('none');
  });

  it('starts tour when startTour is called', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('start'));
    expect(screen.getByTestId('state')).toHaveTextContent('running');
    expect(screen.getByTestId('step')).toHaveTextContent('0');
    expect(screen.getByTestId('step-id')).toHaveTextContent(TOUR_STEPS[0].id);
  });

  it('navigates to next step', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('start'));
    await user.click(screen.getByTestId('next'));

    expect(screen.getByTestId('step')).toHaveTextContent('1');
    expect(screen.getByTestId('step-id')).toHaveTextContent(TOUR_STEPS[1].id);
  });

  it('navigates to previous step', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('start'));
    await user.click(screen.getByTestId('next'));
    await user.click(screen.getByTestId('prev'));

    expect(screen.getByTestId('step')).toHaveTextContent('0');
  });

  it('does not go below step 0 on prevStep', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('start'));
    await user.click(screen.getByTestId('prev'));

    expect(screen.getByTestId('step')).toHaveTextContent('0');
  });

  it('completes tour after last step', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('start'));

    // Click next until we reach the last step
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      await user.click(screen.getByTestId('next'));
    }

    // One more next should complete
    await user.click(screen.getByTestId('next'));

    expect(screen.getByTestId('state')).toHaveTextContent('complete');
  });

  it('skips tour and returns to idle', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('start'));
    await user.click(screen.getByTestId('skip'));

    expect(screen.getByTestId('state')).toHaveTextContent('idle');
  });

  it('pauses tour', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('start'));
    await user.click(screen.getByTestId('pause'));

    expect(screen.getByTestId('state')).toHaveTextContent('paused');
  });

  it('triggers router.push when step page differs from current pathname', async () => {
    mockPathname = '/dashboard';
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('start'));
    // Step 0 is dashboard, step 1 is bookings
    await user.click(screen.getByTestId('next'));

    expect(mockPush).toHaveBeenCalledWith(TOUR_STEPS[1].page);
  });

  it('persists state to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('start'));
    await user.click(screen.getByTestId('next'));

    const stored = JSON.parse(localStorage.getItem('demo-tour-state')!);
    expect(stored.stepIndex).toBe(1);
    expect(stored.state).toBe('running');
  });

  it('restores state from localStorage on mount', () => {
    localStorage.setItem('demo-tour-state', JSON.stringify({ stepIndex: 3, state: 'running' }));

    renderWithProvider();

    expect(screen.getByTestId('state')).toHaveTextContent('running');
    expect(screen.getByTestId('step')).toHaveTextContent('3');
  });

  it('clears localStorage when tour completes', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('start'));
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      await user.click(screen.getByTestId('next'));
    }
    await user.click(screen.getByTestId('next'));

    expect(localStorage.getItem('demo-tour-state')).toBeNull();
  });

  it('responds to keyboard navigation (ArrowRight/ArrowLeft/Escape)', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('start'));
    expect(screen.getByTestId('step')).toHaveTextContent('0');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('step')).toHaveTextContent('1');

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('step')).toHaveTextContent('0');

    await user.keyboard('{Escape}');
    expect(screen.getByTestId('state')).toHaveTextContent('idle');
  });

  it('reports correct totalSteps', () => {
    renderWithProvider();
    expect(screen.getByTestId('total')).toHaveTextContent(String(TOUR_STEPS.length));
  });
});

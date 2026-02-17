import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from './toast';

jest.mock('./cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('lucide-react', () => ({
  X: (props: any) => <span data-testid="x-icon" {...props} />,
  CheckCircle2: (props: any) => <span data-testid="check-icon" {...props} />,
  AlertCircle: (props: any) => <span data-testid="alert-icon" {...props} />,
  Info: (props: any) => <span data-testid="info-icon" {...props} />,
}));

function TestConsumer() {
  const { toast } = useToast();
  return (
    <div>
      <button onClick={() => toast('Success message')}>Show Success</button>
      <button onClick={() => toast('Error message', 'error')}>Show Error</button>
      <button onClick={() => toast('Info message', 'info')}>Show Info</button>
    </div>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows toast message when triggered', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('renders success toast with green styling', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Success'));
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-green-600');
  });

  it('renders error toast with red styling', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Error'));
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-red-600');
  });

  it('renders info toast with blue styling', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Info'));
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-blue-600');
  });

  it('auto-dismisses toast after 3000ms', () => {
    jest.useFakeTimers();

    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Success message')).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  it('close button removes toast immediately', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();

    // The close button is inside the toast - find the button within the alert
    const alert = screen.getByRole('alert');
    const closeButton = alert.querySelector('button');
    fireEvent.click(closeButton!);

    expect(screen.queryByText('Success message')).not.toBeInTheDocument();
  });
});

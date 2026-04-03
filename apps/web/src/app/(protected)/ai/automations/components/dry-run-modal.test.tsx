import { render, screen, fireEvent } from '@testing-library/react';
import { DryRunModal } from './dry-run-modal';

jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('lucide-react', () => ({
  X: () => <span data-testid="x-icon">X</span>,
  CheckCircle: () => <span data-testid="check-icon">CheckCircle</span>,
  AlertTriangle: () => <span data-testid="alert-icon">AlertTriangle</span>,
}));

const baseResult = {
  rule: { id: 'r1', name: 'My Rule', trigger: 'BOOKING_CREATED' },
  dryRun: true,
  matchedCount: 2,
  matchedBookings: [
    {
      id: 'b1',
      customerName: 'Alice',
      serviceName: 'Facial',
      startTime: '2026-02-20T10:00:00Z',
      status: 'CONFIRMED',
    },
    {
      id: 'b2',
      customerName: 'Bob',
      serviceName: 'Consult',
      startTime: '2026-02-20T11:00:00Z',
      status: 'PENDING',
    },
  ],
  skipped: [],
  message: 'Rule "My Rule" would match 2 booking(s) in the last 24 hours',
};

describe('DryRunModal', () => {
  it('renders modal with rule name', () => {
    render(<DryRunModal result={baseResult} onClose={jest.fn()} />);
    expect(screen.getByText('Dry Run Results')).toBeInTheDocument();
    expect(screen.getByText('My Rule')).toBeInTheDocument();
  });

  it('shows summary message', () => {
    render(<DryRunModal result={baseResult} onClose={jest.fn()} />);
    expect(screen.getByTestId('dry-run-summary')).toHaveTextContent('would match 2 booking(s)');
  });

  it('renders matched bookings', () => {
    render(<DryRunModal result={baseResult} onClose={jest.fn()} />);
    expect(screen.getAllByTestId('matched-booking')).toHaveLength(2);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Facial')).toBeInTheDocument();
  });

  it('renders skipped bookings', () => {
    const result = {
      ...baseResult,
      matchedCount: 1,
      matchedBookings: [baseResult.matchedBookings[0]],
      skipped: [{ bookingId: 'b2', reason: 'Service kind mismatch (expected CONSULT)' }],
    };
    render(<DryRunModal result={result} onClose={jest.fn()} />);
    expect(screen.getAllByTestId('skipped-booking')).toHaveLength(1);
    expect(screen.getByText('Service kind mismatch (expected CONSULT)')).toBeInTheDocument();
  });

  it('shows no-match state when no bookings matched', () => {
    const result = {
      ...baseResult,
      matchedCount: 0,
      matchedBookings: [],
      message: 'Rule "My Rule" would not match any bookings right now',
    };
    render(<DryRunModal result={result} onClose={jest.fn()} />);
    expect(screen.getByTestId('dry-run-summary')).toHaveTextContent('would not match');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<DryRunModal result={baseResult} onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X icon is clicked', () => {
    const onClose = jest.fn();
    render(<DryRunModal result={baseResult} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('x-icon'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows status badge for matched bookings', () => {
    render(<DryRunModal result={baseResult} onClose={jest.fn()} />);
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('shows matched count header', () => {
    render(<DryRunModal result={baseResult} onClose={jest.fn()} />);
    expect(screen.getByText('Matched Bookings (2)')).toBeInTheDocument();
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { DepositCard } from './deposit-card';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('DepositCard', () => {
  const defaultProps = {
    id: 'dep-1',
    customerName: 'Emma Wilson',
    serviceName: 'Botox Treatment',
    depositAmount: 50,
    bookingDate: 'Sat, Mar 1',
    status: 'PENDING',
  };

  it('renders customer name and service', () => {
    render(<DepositCard {...defaultProps} />);

    expect(screen.getByText('Emma Wilson')).toBeInTheDocument();
    expect(screen.getByText(/Botox Treatment/)).toBeInTheDocument();
  });

  it('renders deposit amount', () => {
    render(<DepositCard {...defaultProps} />);

    expect(screen.getByTestId('deposit-amount-dep-1')).toHaveTextContent('$50.00');
  });

  it('renders booking date', () => {
    render(<DepositCard {...defaultProps} />);

    expect(screen.getByText('Appointment: Sat, Mar 1')).toBeInTheDocument();
  });

  it('renders send reminder button when callback provided', () => {
    const onSendReminder = jest.fn();
    render(<DepositCard {...defaultProps} onSendReminder={onSendReminder} />);

    expect(screen.getByTestId('deposit-send-dep-1')).toBeInTheDocument();
  });

  it('calls onSendReminder with id', () => {
    const onSendReminder = jest.fn();
    render(<DepositCard {...defaultProps} onSendReminder={onSendReminder} />);

    fireEvent.click(screen.getByTestId('deposit-send-dep-1'));

    expect(onSendReminder).toHaveBeenCalledWith('dep-1');
  });

  it('renders dismiss button when callback provided', () => {
    const onDismiss = jest.fn();
    render(<DepositCard {...defaultProps} onDismiss={onDismiss} />);

    expect(screen.getByTestId('deposit-dismiss-dep-1')).toBeInTheDocument();
  });

  it('calls onDismiss with id', () => {
    const onDismiss = jest.fn();
    render(<DepositCard {...defaultProps} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId('deposit-dismiss-dep-1'));

    expect(onDismiss).toHaveBeenCalledWith('dep-1');
  });

  it('hides action buttons when not pending', () => {
    render(
      <DepositCard
        {...defaultProps}
        status="APPROVED"
        onSendReminder={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('deposit-send-dep-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deposit-dismiss-dep-1')).not.toBeInTheDocument();
  });

  it('shows status text when not pending', () => {
    render(<DepositCard {...defaultProps} status="APPROVED" />);

    expect(screen.getByText('approved')).toBeInTheDocument();
  });

  it('renders with test id', () => {
    render(<DepositCard {...defaultProps} />);

    expect(screen.getByTestId('deposit-card-dep-1')).toBeInTheDocument();
  });

  it('renders without booking date', () => {
    render(<DepositCard {...defaultProps} bookingDate={undefined} />);

    expect(screen.queryByText(/Appointment:/)).not.toBeInTheDocument();
  });
});

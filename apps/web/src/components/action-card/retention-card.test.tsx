import { render, screen, fireEvent } from '@testing-library/react';
import { RetentionCard } from './retention-card';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('RetentionCard', () => {
  const defaultProps = {
    id: 'card1',
    customerName: 'Jane Doe',
    avgDaysBetween: 30,
    daysSinceLastBooking: 50,
    lastServiceName: 'Facial Treatment',
    totalBookings: 5,
  };

  it('renders card with customer name', () => {
    render(<RetentionCard {...defaultProps} />);

    expect(screen.getByTestId('retention-card-card1')).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe may be overdue/)).toBeInTheDocument();
  });

  it('displays retention icon', () => {
    render(<RetentionCard {...defaultProps} />);

    expect(screen.getByTestId('retention-icon')).toBeInTheDocument();
  });

  it('shows last service name and total bookings', () => {
    render(<RetentionCard {...defaultProps} />);

    expect(screen.getByText(/Facial Treatment/)).toBeInTheDocument();
    expect(screen.getByText(/5 total bookings/)).toBeInTheDocument();
  });

  it('displays cadence information', () => {
    render(<RetentionCard {...defaultProps} />);

    expect(screen.getByTestId('cadence-info')).toBeInTheDocument();
    expect(screen.getByText('30 days')).toBeInTheDocument();
    expect(screen.getByText('20 days')).toBeInTheDocument(); // 50 - 30 = 20 overdue
  });

  it('renders follow-up button when pending and callback provided', () => {
    const onFollowUp = jest.fn();
    render(<RetentionCard {...defaultProps} onFollowUp={onFollowUp} />);

    expect(screen.getByTestId('followup-card1')).toBeInTheDocument();
    expect(screen.getByText('Send Follow-up')).toBeInTheDocument();
  });

  it('calls onFollowUp with card id', () => {
    const onFollowUp = jest.fn();
    render(<RetentionCard {...defaultProps} onFollowUp={onFollowUp} />);

    fireEvent.click(screen.getByTestId('followup-card1'));

    expect(onFollowUp).toHaveBeenCalledWith('card1');
  });

  it('renders dismiss button when pending and callback provided', () => {
    const onDismiss = jest.fn();
    render(<RetentionCard {...defaultProps} onDismiss={onDismiss} />);

    expect(screen.getByTestId('dismiss-card1')).toBeInTheDocument();
  });

  it('calls onDismiss with card id', () => {
    const onDismiss = jest.fn();
    render(<RetentionCard {...defaultProps} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId('dismiss-card1'));

    expect(onDismiss).toHaveBeenCalledWith('card1');
  });

  it('hides buttons when status is not PENDING', () => {
    render(
      <RetentionCard
        {...defaultProps}
        status="APPROVED"
        onFollowUp={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('followup-card1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dismiss-card1')).not.toBeInTheDocument();
  });

  it('shows 0 overdue days when not actually overdue', () => {
    render(
      <RetentionCard
        {...defaultProps}
        daysSinceLastBooking={20}
        avgDaysBetween={30}
      />,
    );

    expect(screen.getByText('0 days')).toBeInTheDocument();
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteFollowupCard } from './quote-followup-card';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('QuoteFollowupCard', () => {
  const defaultProps = {
    id: 'card1',
    customerName: 'Jane Doe',
    serviceName: 'Facial Treatment',
    totalAmount: 350,
    daysSinceCreated: 5,
  };

  it('renders card with customer name', () => {
    render(<QuoteFollowupCard {...defaultProps} />);

    expect(screen.getByTestId('quote-followup-card-card1')).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
  });

  it('displays quote icon', () => {
    render(<QuoteFollowupCard {...defaultProps} />);

    expect(screen.getByTestId('quote-icon')).toBeInTheDocument();
  });

  it('shows service name and amount', () => {
    render(<QuoteFollowupCard {...defaultProps} />);

    expect(screen.getByText(/Facial Treatment/)).toBeInTheDocument();
    expect(screen.getByText(/\$350\.00/)).toBeInTheDocument();
  });

  it('shows days since created', () => {
    render(<QuoteFollowupCard {...defaultProps} />);

    expect(screen.getByText('5 days')).toBeInTheDocument();
  });

  it('renders follow-up button when pending and callback provided', () => {
    const onFollowUp = jest.fn();
    render(<QuoteFollowupCard {...defaultProps} onFollowUp={onFollowUp} />);

    expect(screen.getByTestId('followup-card1')).toBeInTheDocument();
  });

  it('calls onFollowUp with card id', () => {
    const onFollowUp = jest.fn();
    render(<QuoteFollowupCard {...defaultProps} onFollowUp={onFollowUp} />);

    fireEvent.click(screen.getByTestId('followup-card1'));

    expect(onFollowUp).toHaveBeenCalledWith('card1');
  });

  it('renders dismiss button when callback provided', () => {
    const onDismiss = jest.fn();
    render(<QuoteFollowupCard {...defaultProps} onDismiss={onDismiss} />);

    expect(screen.getByTestId('dismiss-card1')).toBeInTheDocument();
  });

  it('calls onDismiss with card id', () => {
    const onDismiss = jest.fn();
    render(<QuoteFollowupCard {...defaultProps} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId('dismiss-card1'));

    expect(onDismiss).toHaveBeenCalledWith('card1');
  });

  it('hides buttons when not pending', () => {
    render(
      <QuoteFollowupCard
        {...defaultProps}
        status="APPROVED"
        onFollowUp={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('followup-card1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dismiss-card1')).not.toBeInTheDocument();
  });
});

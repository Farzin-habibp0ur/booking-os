import { render, screen, fireEvent } from '@testing-library/react';
import { ActionCardInline, InlineActionCardData } from './action-card-inline';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const mockCard: InlineActionCardData = {
  id: 'card-1',
  type: 'BOOKING_CONFIRM',
  title: 'Confirm booking for Emma',
  description: 'Because Emma wants to book Botox on Feb 25 at 10:00',
  suggestedAction: 'Approve to confirm the booking',
  status: 'PENDING',
};

describe('ActionCardInline', () => {
  it('renders card with title and description', () => {
    render(<ActionCardInline card={mockCard} />);

    expect(screen.getByText('Confirm booking for Emma')).toBeInTheDocument();
    expect(screen.getByText(/Emma wants to book Botox/)).toBeInTheDocument();
  });

  it('renders type badge', () => {
    render(<ActionCardInline card={mockCard} />);

    expect(screen.getByTestId('inline-card-badge-card-1')).toHaveTextContent('Booking');
  });

  it('renders suggested action when pending', () => {
    render(<ActionCardInline card={mockCard} />);

    expect(screen.getByText('Approve to confirm the booking')).toBeInTheDocument();
  });

  it('renders approve button when onApprove provided', () => {
    const onApprove = jest.fn();
    render(<ActionCardInline card={mockCard} onApprove={onApprove} />);

    expect(screen.getByTestId('inline-approve-card-1')).toBeInTheDocument();
  });

  it('calls onApprove with card id', () => {
    const onApprove = jest.fn();
    render(<ActionCardInline card={mockCard} onApprove={onApprove} />);

    fireEvent.click(screen.getByTestId('inline-approve-card-1'));

    expect(onApprove).toHaveBeenCalledWith('card-1');
  });

  it('renders dismiss button when onDismiss provided', () => {
    const onDismiss = jest.fn();
    render(<ActionCardInline card={mockCard} onDismiss={onDismiss} />);

    expect(screen.getByTestId('inline-dismiss-card-1')).toBeInTheDocument();
  });

  it('calls onDismiss with card id', () => {
    const onDismiss = jest.fn();
    render(<ActionCardInline card={mockCard} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId('inline-dismiss-card-1'));

    expect(onDismiss).toHaveBeenCalledWith('card-1');
  });

  it('hides action buttons when status is not PENDING', () => {
    render(
      <ActionCardInline
        card={{ ...mockCard, status: 'APPROVED' }}
        onApprove={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('inline-approve-card-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inline-dismiss-card-1')).not.toBeInTheDocument();
  });

  it('hides suggested action when not pending', () => {
    render(
      <ActionCardInline card={{ ...mockCard, status: 'DISMISSED' }} />,
    );

    expect(screen.queryByText('Approve to confirm the booking')).not.toBeInTheDocument();
  });

  it('shows status text for non-pending cards', () => {
    render(
      <ActionCardInline card={{ ...mockCard, status: 'APPROVED' }} />,
    );

    expect(screen.getByText('approved')).toBeInTheDocument();
  });

  it('renders with test id based on card id', () => {
    render(<ActionCardInline card={mockCard} />);

    expect(screen.getByTestId('inline-card-card-1')).toBeInTheDocument();
  });

  it('handles unknown card types', () => {
    render(
      <ActionCardInline card={{ ...mockCard, type: 'CUSTOM_TYPE' }} />,
    );

    expect(screen.getByTestId('inline-card-badge-card-1')).toHaveTextContent('CUSTOM_TYPE');
  });

  it('handles card without suggested action', () => {
    render(
      <ActionCardInline card={{ ...mockCard, suggestedAction: null }} />,
    );

    expect(screen.queryByText('Approve to confirm the booking')).not.toBeInTheDocument();
  });

  it('renders both approve and dismiss buttons together', () => {
    render(
      <ActionCardInline
        card={mockCard}
        onApprove={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByTestId('inline-card-actions-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('inline-approve-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('inline-dismiss-card-1')).toBeInTheDocument();
  });
});

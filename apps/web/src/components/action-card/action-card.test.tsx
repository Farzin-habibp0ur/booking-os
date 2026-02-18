import { render, screen, fireEvent } from '@testing-library/react';
import { ActionCard, ActionCardData } from './action-card';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const mockCard: ActionCardData = {
  id: 'card1',
  type: 'DEPOSIT_PENDING',
  category: 'URGENT_TODAY',
  priority: 80,
  title: 'Deposit needed for Emma',
  description: 'Because booking is pending deposit for 48+ hours',
  suggestedAction: 'Send deposit reminder',
  preview: { before: { status: 'PENDING_DEPOSIT' }, after: { status: 'CONFIRMED' } },
  ctaConfig: [],
  status: 'PENDING',
  autonomyLevel: 'ASSISTED',
  customer: { id: 'cust1', name: 'Emma Wilson' },
  booking: { id: 'book1', startTime: '2026-02-20T10:00:00Z' },
  staff: null,
  createdAt: '2026-02-18T10:00:00Z',
};

describe('ActionCard', () => {
  it('renders card title and description', () => {
    render(<ActionCard card={mockCard} />);

    expect(screen.getByText('Deposit needed for Emma')).toBeInTheDocument();
    expect(
      screen.getByText('Because booking is pending deposit for 48+ hours'),
    ).toBeInTheDocument();
  });

  it('renders customer name', () => {
    render(<ActionCard card={mockCard} />);

    expect(screen.getByText('Emma Wilson')).toBeInTheDocument();
  });

  it('renders category badge', () => {
    render(<ActionCard card={mockCard} />);

    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('shows AUTO badge when autonomyLevel is AUTO', () => {
    render(<ActionCard card={{ ...mockCard, autonomyLevel: 'AUTO' }} />);

    expect(screen.getByText('Auto')).toBeInTheDocument();
  });

  it('does not show AUTO badge when autonomyLevel is ASSISTED', () => {
    render(<ActionCard card={mockCard} />);

    expect(screen.queryByText('Auto')).not.toBeInTheDocument();
  });

  it('renders action buttons when status is PENDING', () => {
    const onApprove = jest.fn();
    const onDismiss = jest.fn();
    const onSnooze = jest.fn();

    render(
      <ActionCard
        card={mockCard}
        onApprove={onApprove}
        onDismiss={onDismiss}
        onSnooze={onSnooze}
      />,
    );

    expect(screen.getByTestId('approve-card1')).toBeInTheDocument();
    expect(screen.getByTestId('dismiss-card1')).toBeInTheDocument();
    expect(screen.getByTestId('snooze-card1')).toBeInTheDocument();
  });

  it('does not render action buttons when status is not PENDING', () => {
    const onApprove = jest.fn();

    render(<ActionCard card={{ ...mockCard, status: 'APPROVED' }} onApprove={onApprove} />);

    expect(screen.queryByTestId('approve-card1')).not.toBeInTheDocument();
  });

  it('calls onApprove when approve button clicked', () => {
    const onApprove = jest.fn();

    render(<ActionCard card={mockCard} onApprove={onApprove} />);
    fireEvent.click(screen.getByTestId('approve-card1'));

    expect(onApprove).toHaveBeenCalledWith('card1');
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = jest.fn();

    render(<ActionCard card={mockCard} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('dismiss-card1'));

    expect(onDismiss).toHaveBeenCalledWith('card1');
  });

  it('calls onSnooze when snooze button clicked', () => {
    const onSnooze = jest.fn();

    render(<ActionCard card={mockCard} onSnooze={onSnooze} />);
    fireEvent.click(screen.getByTestId('snooze-card1'));

    expect(onSnooze).toHaveBeenCalledWith('card1');
  });

  it('renders preview button when preview exists and onPreview provided', () => {
    const onPreview = jest.fn();

    render(<ActionCard card={mockCard} onPreview={onPreview} />);

    expect(screen.getByTestId('preview-card1')).toBeInTheDocument();
  });

  it('calls onPreview with card data when preview button clicked', () => {
    const onPreview = jest.fn();

    render(<ActionCard card={mockCard} onPreview={onPreview} />);
    fireEvent.click(screen.getByTestId('preview-card1'));

    expect(onPreview).toHaveBeenCalledWith(mockCard);
  });

  it('hides description in compact mode', () => {
    render(<ActionCard card={mockCard} compact />);

    expect(
      screen.queryByText('Because booking is pending deposit for 48+ hours'),
    ).not.toBeInTheDocument();
  });

  it('renders execute button when onExecute provided', () => {
    const onExecute = jest.fn();

    render(<ActionCard card={mockCard} onExecute={onExecute} />);

    expect(screen.getByTestId('execute-card1')).toBeInTheDocument();
  });

  it('uses test id with card id', () => {
    render(<ActionCard card={mockCard} />);

    expect(screen.getByTestId('action-card-card1')).toBeInTheDocument();
  });
});

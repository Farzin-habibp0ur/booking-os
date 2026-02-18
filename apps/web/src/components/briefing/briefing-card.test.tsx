import { render, screen, fireEvent } from '@testing-library/react';
import { BriefingCard, BriefingCardData } from './briefing-card';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const mockCard: BriefingCardData = {
  id: 'card-1',
  type: 'DEPOSIT_PENDING',
  category: 'URGENT_TODAY',
  priority: 90,
  title: 'Deposit pending for Emma',
  description: 'Because Botox is in 2 days and deposit has not been collected.',
  suggestedAction: 'Send deposit reminder via WhatsApp',
  status: 'PENDING',
  autonomyLevel: 'ASSISTED',
  customer: { id: 'c1', name: 'Emma Wilson' },
  booking: { id: 'b1', startTime: '2026-02-20T10:00:00Z' },
  createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
};

describe('BriefingCard', () => {
  it('renders title and description', () => {
    render(<BriefingCard card={mockCard} />);

    expect(screen.getByText('Deposit pending for Emma')).toBeInTheDocument();
    expect(screen.getByText(/Botox is in 2 days/)).toBeInTheDocument();
  });

  it('renders suggested action', () => {
    render(<BriefingCard card={mockCard} />);

    expect(screen.getByText('Send deposit reminder via WhatsApp')).toBeInTheDocument();
  });

  it('renders customer name', () => {
    render(<BriefingCard card={mockCard} />);

    expect(screen.getByText('Emma Wilson')).toBeInTheDocument();
  });

  it('calls onView when card clicked', () => {
    const onView = jest.fn();
    render(<BriefingCard card={mockCard} onView={onView} />);

    fireEvent.click(screen.getByTestId('briefing-card-card-1'));

    expect(onView).toHaveBeenCalledWith(mockCard);
  });

  it('calls onView on Enter key', () => {
    const onView = jest.fn();
    render(<BriefingCard card={mockCard} onView={onView} />);

    fireEvent.keyDown(screen.getByTestId('briefing-card-card-1'), { key: 'Enter' });

    expect(onView).toHaveBeenCalledWith(mockCard);
  });

  it('renders approve button when onApprove provided', () => {
    const onApprove = jest.fn();
    render(<BriefingCard card={mockCard} onApprove={onApprove} />);

    expect(screen.getByTestId('briefing-approve-card-1')).toBeInTheDocument();
  });

  it('calls onApprove and stops propagation', () => {
    const onApprove = jest.fn();
    const onView = jest.fn();
    render(<BriefingCard card={mockCard} onApprove={onApprove} onView={onView} />);

    fireEvent.click(screen.getByTestId('briefing-approve-card-1'));

    expect(onApprove).toHaveBeenCalledWith('card-1');
    expect(onView).not.toHaveBeenCalled();
  });

  it('renders dismiss button when onDismiss provided', () => {
    const onDismiss = jest.fn();
    render(<BriefingCard card={mockCard} onDismiss={onDismiss} />);

    expect(screen.getByTestId('briefing-dismiss-card-1')).toBeInTheDocument();
  });

  it('calls onDismiss and stops propagation', () => {
    const onDismiss = jest.fn();
    const onView = jest.fn();
    render(<BriefingCard card={mockCard} onDismiss={onDismiss} onView={onView} />);

    fireEvent.click(screen.getByTestId('briefing-dismiss-card-1'));

    expect(onDismiss).toHaveBeenCalledWith('card-1');
    expect(onView).not.toHaveBeenCalled();
  });

  it('does not render action buttons when status is not PENDING', () => {
    render(
      <BriefingCard
        card={{ ...mockCard, status: 'APPROVED' }}
        onApprove={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('briefing-approve-card-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('briefing-dismiss-card-1')).not.toBeInTheDocument();
  });

  it('does not render action row when no callbacks provided', () => {
    render(<BriefingCard card={mockCard} />);

    expect(screen.queryByTestId('briefing-approve-card-1')).not.toBeInTheDocument();
  });

  it('renders time ago', () => {
    render(<BriefingCard card={mockCard} />);

    expect(screen.getByText('30m ago')).toBeInTheDocument();
  });
});

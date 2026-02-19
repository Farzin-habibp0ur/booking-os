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

  it('renders contextual action label based on card type', () => {
    const onApprove = jest.fn();
    render(<BriefingCard card={mockCard} onApprove={onApprove} />);

    expect(screen.getByTestId('briefing-approve-card-1')).toBeInTheDocument();
    expect(screen.getByText('Send Reminder')).toBeInTheDocument();
  });

  it('renders "Follow Up" label for stalled quote cards', () => {
    const onApprove = jest.fn();
    render(<BriefingCard card={{ ...mockCard, type: 'STALLED_QUOTE' }} onApprove={onApprove} />);

    expect(screen.getByText('Follow Up')).toBeInTheDocument();
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

  it('shows expand toggle button', () => {
    render(<BriefingCard card={mockCard} />);

    expect(screen.getByTestId('briefing-expand-card-1')).toBeInTheDocument();
  });

  it('expands to show details when expand clicked', () => {
    render(<BriefingCard card={mockCard} />);

    fireEvent.click(screen.getByTestId('briefing-expand-card-1'));

    expect(screen.getByTestId('briefing-details-card-1')).toBeInTheDocument();
  });

  it('shows booking details in expanded view', () => {
    render(
      <BriefingCard
        card={{
          ...mockCard,
          booking: {
            id: 'b1',
            startTime: '2026-02-20T10:00:00Z',
            service: { name: 'Filler Treatment' },
          },
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('briefing-expand-card-1'));

    expect(screen.getByText(/Filler Treatment/)).toBeInTheDocument();
  });

  it('shows staff name in expanded view', () => {
    render(<BriefingCard card={{ ...mockCard, staff: { id: 's1', name: 'Dr. Chen' } }} />);

    fireEvent.click(screen.getByTestId('briefing-expand-card-1'));

    expect(screen.getByText('Dr. Chen')).toBeInTheDocument();
  });

  it('shows snooze button when onSnooze provided', () => {
    render(<BriefingCard card={mockCard} onSnooze={jest.fn()} />);

    expect(screen.getByTestId('briefing-snooze-card-1')).toBeInTheDocument();
  });

  it('opens snooze menu on click', () => {
    render(<BriefingCard card={mockCard} onSnooze={jest.fn()} />);

    fireEvent.click(screen.getByTestId('briefing-snooze-card-1'));

    expect(screen.getByTestId('snooze-menu-card-1')).toBeInTheDocument();
    expect(screen.getByText('1 hour')).toBeInTheDocument();
    expect(screen.getByText('4 hours')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    expect(screen.getByText('Next week')).toBeInTheDocument();
  });

  it('calls onSnooze with correct duration when option selected', () => {
    const onSnooze = jest.fn();
    render(<BriefingCard card={mockCard} onSnooze={onSnooze} />);

    fireEvent.click(screen.getByTestId('briefing-snooze-card-1'));
    fireEvent.click(screen.getByTestId('snooze-option-1'));

    expect(onSnooze).toHaveBeenCalledWith('card-1', expect.any(String));
  });

  it('has category border color for URGENT_TODAY', () => {
    const { container } = render(<BriefingCard card={mockCard} />);

    const cardEl = container.querySelector('[data-testid="briefing-card-card-1"]');
    expect(cardEl?.className).toContain('border-l-red-400');
  });

  it('has category border color for NEEDS_APPROVAL', () => {
    const { container } = render(
      <BriefingCard card={{ ...mockCard, category: 'NEEDS_APPROVAL' }} />,
    );

    const cardEl = container.querySelector('[data-testid="briefing-card-card-1"]');
    expect(cardEl?.className).toContain('border-l-lavender-400');
  });
});

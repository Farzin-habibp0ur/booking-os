import { render, screen, fireEvent } from '@testing-library/react';
import { ActionCardPreview } from './action-card-preview';
import { ActionCardData } from './action-card';

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
  suggestedAction: 'Send deposit reminder via WhatsApp',
  preview: { before: { status: 'PENDING_DEPOSIT' }, after: { status: 'CONFIRMED' } },
  status: 'PENDING',
  autonomyLevel: 'ASSISTED',
  customer: { id: 'cust1', name: 'Emma' },
  booking: null,
  staff: null,
  createdAt: '2026-02-18T10:00:00Z',
};

describe('ActionCardPreview', () => {
  it('renders card title and description', () => {
    render(<ActionCardPreview card={mockCard} onClose={jest.fn()} />);

    expect(screen.getByText('Deposit needed for Emma')).toBeInTheDocument();
    expect(
      screen.getByText('Because booking is pending deposit for 48+ hours'),
    ).toBeInTheDocument();
  });

  it('renders suggested action', () => {
    render(<ActionCardPreview card={mockCard} onClose={jest.fn()} />);

    expect(screen.getByText('Send deposit reminder via WhatsApp')).toBeInTheDocument();
  });

  it('renders before/after preview', () => {
    render(<ActionCardPreview card={mockCard} onClose={jest.fn()} />);

    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = jest.fn();

    render(<ActionCardPreview card={mockCard} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('close-preview'));

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = jest.fn();

    render(<ActionCardPreview card={mockCard} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('action-card-preview'));

    expect(onClose).toHaveBeenCalled();
  });

  it('renders approve/dismiss buttons when card is PENDING', () => {
    render(
      <ActionCardPreview
        card={mockCard}
        onClose={jest.fn()}
        onApprove={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByTestId('preview-approve')).toBeInTheDocument();
    expect(screen.getByTestId('preview-dismiss')).toBeInTheDocument();
  });

  it('calls onApprove and onClose when approve clicked', () => {
    const onApprove = jest.fn();
    const onClose = jest.fn();

    render(<ActionCardPreview card={mockCard} onClose={onClose} onApprove={onApprove} />);
    fireEvent.click(screen.getByTestId('preview-approve'));

    expect(onApprove).toHaveBeenCalledWith('card1');
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render buttons when card is not PENDING', () => {
    render(
      <ActionCardPreview
        card={{ ...mockCard, status: 'APPROVED' }}
        onClose={jest.fn()}
        onApprove={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('preview-approve')).not.toBeInTheDocument();
  });
});

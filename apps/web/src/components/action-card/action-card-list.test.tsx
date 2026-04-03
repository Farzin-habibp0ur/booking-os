import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActionCardList } from './action-card-list';
import { ActionCardData } from './action-card';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/components/bulk-action-bar', () => ({
  __esModule: true,
  default: ({ count, actions, onClear }: any) =>
    count > 0 ? (
      <div data-testid="bulk-action-bar">
        <span>{count} selected</span>
        {actions.map((a: any) => (
          <button
            key={a.label}
            onClick={a.onClick}
            data-testid={`bulk-${a.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {a.label}
          </button>
        ))}
        <button onClick={onClear} data-testid="bulk-clear">
          Clear
        </button>
      </div>
    ) : null,
}));

const mockCards: ActionCardData[] = [
  {
    id: 'card1',
    type: 'DEPOSIT_PENDING',
    category: 'URGENT_TODAY',
    priority: 90,
    title: 'Urgent: Deposit needed',
    description: 'Deposit pending for 48h',
    status: 'PENDING',
    autonomyLevel: 'ASSISTED',
    customer: { id: 'c1', name: 'Emma' },
    booking: null,
    staff: null,
    createdAt: '2026-02-18T10:00:00Z',
  },
  {
    id: 'card2',
    type: 'OPEN_SLOT',
    category: 'OPPORTUNITY',
    priority: 60,
    title: 'Open slot available',
    description: 'Gap detected tomorrow',
    status: 'PENDING',
    autonomyLevel: 'ASSISTED',
    customer: null,
    booking: null,
    staff: null,
    createdAt: '2026-02-18T11:00:00Z',
  },
  {
    id: 'card3',
    type: 'OVERDUE_REPLY',
    category: 'URGENT_TODAY',
    priority: 85,
    title: 'Overdue reply',
    description: 'Customer waiting 2h',
    status: 'PENDING',
    autonomyLevel: 'ASSISTED',
    customer: { id: 'c2', name: 'John' },
    booking: null,
    staff: null,
    createdAt: '2026-02-18T09:00:00Z',
  },
];

describe('ActionCardList', () => {
  it('renders all cards', () => {
    render(<ActionCardList cards={mockCards} />);

    expect(screen.getByTestId('action-card-list')).toBeInTheDocument();
    expect(screen.getByText('Urgent: Deposit needed')).toBeInTheDocument();
    expect(screen.getByText('Open slot available')).toBeInTheDocument();
    expect(screen.getByText('Overdue reply')).toBeInTheDocument();
  });

  it('shows grouped categories', () => {
    render(<ActionCardList cards={mockCards} grouped />);

    expect(screen.getByText('Urgent Today')).toBeInTheDocument();
    expect(screen.getByText('Opportunities')).toBeInTheDocument();
  });

  it('shows filter chips with counts', () => {
    render(<ActionCardList cards={mockCards} />);

    expect(screen.getByTestId('filter-all')).toHaveTextContent('All (3)');
    expect(screen.getByTestId('filter-URGENT_TODAY')).toHaveTextContent('Urgent Today (2)');
    expect(screen.getByTestId('filter-OPPORTUNITY')).toHaveTextContent('Opportunities (1)');
  });

  it('filters by category when chip clicked', () => {
    render(<ActionCardList cards={mockCards} />);

    fireEvent.click(screen.getByTestId('filter-OPPORTUNITY'));

    expect(screen.getByText('Open slot available')).toBeInTheDocument();
    expect(screen.queryByText('Urgent: Deposit needed')).not.toBeInTheDocument();
  });

  it('clears filter when All clicked', () => {
    render(<ActionCardList cards={mockCards} />);

    fireEvent.click(screen.getByTestId('filter-OPPORTUNITY'));
    fireEvent.click(screen.getByTestId('filter-all'));

    expect(screen.getByText('Urgent: Deposit needed')).toBeInTheDocument();
    expect(screen.getByText('Open slot available')).toBeInTheDocument();
  });

  it('shows empty state when no cards', () => {
    render(<ActionCardList cards={[]} />);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders ungrouped list when grouped=false', () => {
    render(<ActionCardList cards={mockCards} grouped={false} />);

    expect(screen.queryByText('Urgent Today')).not.toBeInTheDocument();
    expect(screen.getByText('Urgent: Deposit needed')).toBeInTheDocument();
  });

  it('passes callbacks to ActionCard children', () => {
    const onApprove = jest.fn();

    render(<ActionCardList cards={mockCards} onApprove={onApprove} />);
    fireEvent.click(screen.getByTestId('approve-card1'));

    expect(onApprove).toHaveBeenCalledWith('card1');
  });

  it('filter buttons have aria-label attributes', () => {
    render(<ActionCardList cards={mockCards} />);

    expect(screen.getByTestId('filter-all')).toHaveAttribute('aria-label', 'Show all action cards');
    expect(screen.getByTestId('filter-URGENT_TODAY')).toHaveAttribute(
      'aria-label',
      'Filter by Urgent Today cards',
    );
  });

  it('filter group has role=radiogroup', () => {
    render(<ActionCardList cards={mockCards} />);

    expect(
      screen.getByRole('radiogroup', { name: 'Filter action cards by category' }),
    ).toBeInTheDocument();
  });

  describe('FIX-20: multi-select bulk actions', () => {
    it('shows checkboxes when onBulkDismiss provided', () => {
      render(<ActionCardList cards={mockCards} onBulkDismiss={jest.fn()} />);

      expect(screen.getByTestId('select-card1')).toBeInTheDocument();
      expect(screen.getByTestId('select-card2')).toBeInTheDocument();
    });

    it('BulkActionBar appears after selecting a card', () => {
      render(<ActionCardList cards={mockCards} onBulkDismiss={jest.fn()} />);

      expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('select-card1'));
      expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('calls onBulkDismiss with selected ids', async () => {
      const onBulkDismiss = jest.fn().mockResolvedValue(undefined);
      render(<ActionCardList cards={mockCards} onBulkDismiss={onBulkDismiss} />);

      fireEvent.click(screen.getByTestId('select-card1'));
      fireEvent.click(screen.getByTestId('select-card2'));
      fireEvent.click(screen.getByTestId('bulk-dismiss-selected'));

      expect(onBulkDismiss).toHaveBeenCalledWith(expect.arrayContaining(['card1', 'card2']));
    });

    it('clears selection after dismiss', async () => {
      const onBulkDismiss = jest.fn().mockResolvedValue(undefined);
      render(<ActionCardList cards={mockCards} onBulkDismiss={onBulkDismiss} />);

      fireEvent.click(screen.getByTestId('select-card1'));
      fireEvent.click(screen.getByTestId('bulk-dismiss-selected'));

      await waitFor(() => {
        expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
      });
    });
  });
});

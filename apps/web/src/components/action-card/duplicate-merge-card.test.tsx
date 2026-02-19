import { render, screen, fireEvent } from '@testing-library/react';
import { DuplicateMergeCard } from './duplicate-merge-card';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const defaultProps = {
  id: 'card1',
  customer1: { id: 'c1', name: 'Jane Doe', phone: '555-1234', email: 'jane@test.com' },
  customer2: { id: 'c2', name: 'Jane D.', phone: '555-1234', email: null },
  matchFields: ['phone', 'name'],
  confidence: 0.85,
};

describe('DuplicateMergeCard', () => {
  it('renders card with possible duplicate heading', () => {
    render(<DuplicateMergeCard {...defaultProps} />);

    expect(screen.getByTestId('duplicate-card-card1')).toBeInTheDocument();
    expect(screen.getByText('Possible Duplicate')).toBeInTheDocument();
  });

  it('displays confidence badge', () => {
    render(<DuplicateMergeCard {...defaultProps} />);

    expect(screen.getByTestId('confidence-badge')).toBeInTheDocument();
    expect(screen.getByText('85% match')).toBeInTheDocument();
  });

  it('shows customer comparison', () => {
    render(<DuplicateMergeCard {...defaultProps} />);

    expect(screen.getByTestId('customer-comparison')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane D.')).toBeInTheDocument();
  });

  it('shows match fields', () => {
    render(<DuplicateMergeCard {...defaultProps} />);

    expect(screen.getByTestId('match-fields')).toBeInTheDocument();
    expect(screen.getByText('phone')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('renders merge button when callback provided', () => {
    const onMerge = jest.fn();
    render(<DuplicateMergeCard {...defaultProps} onMerge={onMerge} />);

    expect(screen.getByTestId('merge-card1')).toBeInTheDocument();
  });

  it('calls onMerge with card id and customer ids', () => {
    const onMerge = jest.fn();
    render(<DuplicateMergeCard {...defaultProps} onMerge={onMerge} />);

    fireEvent.click(screen.getByTestId('merge-card1'));

    expect(onMerge).toHaveBeenCalledWith('card1', 'c1', 'c2');
  });

  it('renders not-duplicate button when callback provided', () => {
    const onNotDuplicate = jest.fn();
    render(<DuplicateMergeCard {...defaultProps} onNotDuplicate={onNotDuplicate} />);

    expect(screen.getByTestId('not-duplicate-card1')).toBeInTheDocument();
  });

  it('calls onNotDuplicate with card id', () => {
    const onNotDuplicate = jest.fn();
    render(<DuplicateMergeCard {...defaultProps} onNotDuplicate={onNotDuplicate} />);

    fireEvent.click(screen.getByTestId('not-duplicate-card1'));

    expect(onNotDuplicate).toHaveBeenCalledWith('card1');
  });

  it('renders dismiss button when callback provided', () => {
    const onDismiss = jest.fn();
    render(<DuplicateMergeCard {...defaultProps} onDismiss={onDismiss} />);

    expect(screen.getByTestId('dismiss-card1')).toBeInTheDocument();
  });

  it('hides buttons when not pending', () => {
    render(
      <DuplicateMergeCard
        {...defaultProps}
        status="APPROVED"
        onMerge={jest.fn()}
        onNotDuplicate={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('merge-card1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('not-duplicate-card1')).not.toBeInTheDocument();
  });

  it('displays duplicate icon', () => {
    render(<DuplicateMergeCard {...defaultProps} />);

    expect(screen.getByTestId('duplicate-icon')).toBeInTheDocument();
  });

  it('shows customer email when available', () => {
    render(<DuplicateMergeCard {...defaultProps} />);

    expect(screen.getByText('jane@test.com')).toBeInTheDocument();
  });
});

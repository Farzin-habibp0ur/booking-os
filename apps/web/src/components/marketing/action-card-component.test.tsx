jest.mock('@/lib/cn', () => ({ cn: (...args) => args.filter(Boolean).join(' ') }));
jest.mock('lucide-react', () => ({
  CheckCircle: () => <span data-testid="check-circle" />,
  X: () => <span data-testid="x-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { ActionCardComponent, ActionCard, PRIORITY_CONFIG } from './action-card-component';

const mockCard: ActionCard = {
  id: 'card-1',
  title: 'Review blog post about SEO',
  description: 'New blog post ready for review and approval',
  priority: 'NEEDS_APPROVAL',
  sourceAgent: 'Blog Writer',
  confidence: 0.87,
  createdAt: '2027-01-15T12:00:00Z',
};

const baseProps = {
  card: mockCard,
  onApprove: jest.fn(),
  onDismiss: jest.fn(),
  onSnooze: jest.fn(),
};

describe('ActionCardComponent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders with card-specific data-testid', () => {
    render(<ActionCardComponent {...baseProps} />);
    expect(screen.getByTestId('action-card-card-1')).toBeInTheDocument();
  });

  it('shows card title and description', () => {
    render(<ActionCardComponent {...baseProps} />);
    expect(screen.getByText('Review blog post about SEO')).toBeInTheDocument();
    expect(screen.getByText('New blog post ready for review and approval')).toBeInTheDocument();
  });

  it('shows source agent', () => {
    render(<ActionCardComponent {...baseProps} />);
    expect(screen.getByText('Blog Writer')).toBeInTheDocument();
  });

  it('shows confidence badge', () => {
    render(<ActionCardComponent {...baseProps} />);
    expect(screen.getByTestId('confidence-badge')).toHaveTextContent('87% confidence');
  });

  it('does not show confidence badge when absent', () => {
    render(<ActionCardComponent {...baseProps} card={{ ...mockCard, confidence: undefined }} />);
    expect(screen.queryByTestId('confidence-badge')).not.toBeInTheDocument();
  });

  it('has amber border for NEEDS_APPROVAL priority', () => {
    render(<ActionCardComponent {...baseProps} />);
    const card = screen.getByTestId('action-card-card-1');
    expect(card.className).toContain('border-amber-400');
  });

  it('has red border for URGENT_TODAY priority', () => {
    render(<ActionCardComponent {...baseProps} card={{ ...mockCard, priority: 'URGENT_TODAY' }} />);
    const card = screen.getByTestId('action-card-card-1');
    expect(card.className).toContain('border-red-400');
  });

  it('has sage border for OPPORTUNITY priority', () => {
    render(<ActionCardComponent {...baseProps} card={{ ...mockCard, priority: 'OPPORTUNITY' }} />);
    const card = screen.getByTestId('action-card-card-1');
    expect(card.className).toContain('border-sage-400');
  });

  it('has slate border for HYGIENE priority', () => {
    render(<ActionCardComponent {...baseProps} card={{ ...mockCard, priority: 'HYGIENE' }} />);
    const card = screen.getByTestId('action-card-card-1');
    expect(card.className).toContain('border-slate-400');
  });

  it('calls onApprove when approve clicked', () => {
    render(<ActionCardComponent {...baseProps} />);
    fireEvent.click(screen.getByTestId('action-approve'));
    expect(baseProps.onApprove).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when dismiss clicked', () => {
    render(<ActionCardComponent {...baseProps} />);
    fireEvent.click(screen.getByTestId('action-dismiss'));
    expect(baseProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onSnooze when snooze clicked', () => {
    render(<ActionCardComponent {...baseProps} />);
    fireEvent.click(screen.getByTestId('action-snooze'));
    expect(baseProps.onSnooze).toHaveBeenCalledTimes(1);
  });

  it('shows checkbox when onSelect provided', () => {
    const onSelect = jest.fn();
    render(<ActionCardComponent {...baseProps} onSelect={onSelect} />);
    expect(screen.getByTestId('action-checkbox')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('action-checkbox'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('does not show checkbox when onSelect absent', () => {
    render(<ActionCardComponent {...baseProps} />);
    expect(screen.queryByTestId('action-checkbox')).not.toBeInTheDocument();
  });

  it('applies ring when selected', () => {
    render(<ActionCardComponent {...baseProps} isSelected />);
    const card = screen.getByTestId('action-card-card-1');
    expect(card.className).toContain('ring-2');
  });

  it('applies glow animation when isNew', () => {
    render(<ActionCardComponent {...baseProps} isNew />);
    const card = screen.getByTestId('action-card-card-1');
    expect(card.className).toContain('animate-badge-flash');
  });

  it('exports PRIORITY_CONFIG with 4 priorities', () => {
    expect(Object.keys(PRIORITY_CONFIG)).toHaveLength(4);
  });
});

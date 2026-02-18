import { render, screen, fireEvent } from '@testing-library/react';
import { OpportunityCard } from './opportunity-card';
import { BriefingCardData } from './briefing-card';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const mockOpportunity: BriefingCardData = {
  id: 'opp-1',
  type: 'OPEN_SLOT',
  category: 'OPPORTUNITY',
  priority: 55,
  title: '3 open slots tomorrow',
  description: 'Because tomorrow has 3 unfilled slots and 5 waitlist customers are waiting.',
  suggestedAction: 'Notify waitlist customers about availability',
  status: 'PENDING',
  createdAt: new Date().toISOString(),
};

describe('OpportunityCard', () => {
  it('renders title and description', () => {
    render(<OpportunityCard card={mockOpportunity} />);

    expect(screen.getByText('3 open slots tomorrow')).toBeInTheDocument();
    expect(screen.getByText(/3 unfilled slots/)).toBeInTheDocument();
  });

  it('renders suggested action', () => {
    render(<OpportunityCard card={mockOpportunity} />);

    expect(screen.getByText('Notify waitlist customers about availability')).toBeInTheDocument();
  });

  it('calls onAction when clicked', () => {
    const onAction = jest.fn();
    render(<OpportunityCard card={mockOpportunity} onAction={onAction} />);

    fireEvent.click(screen.getByTestId('opportunity-card-opp-1'));

    expect(onAction).toHaveBeenCalledWith(mockOpportunity);
  });

  it('calls onAction on Enter key', () => {
    const onAction = jest.fn();
    render(<OpportunityCard card={mockOpportunity} onAction={onAction} />);

    fireEvent.keyDown(screen.getByTestId('opportunity-card-opp-1'), { key: 'Enter' });

    expect(onAction).toHaveBeenCalledWith(mockOpportunity);
  });

  it('does not render suggested action section when not provided', () => {
    render(
      <OpportunityCard card={{ ...mockOpportunity, suggestedAction: null }} />,
    );

    expect(
      screen.queryByText('Notify waitlist customers about availability'),
    ).not.toBeInTheDocument();
  });

  it('renders with test id based on card id', () => {
    render(<OpportunityCard card={mockOpportunity} />);

    expect(screen.getByTestId('opportunity-card-opp-1')).toBeInTheDocument();
  });

  it('handles different opportunity types', () => {
    render(
      <OpportunityCard card={{ ...mockOpportunity, type: 'RETENTION_DUE', title: 'Retention check' }} />,
    );

    expect(screen.getByText('Retention check')).toBeInTheDocument();
  });
});

jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));

import { render, screen } from '@testing-library/react';
import { AgentPerformance } from './agent-performance';

const mockStats = {
  total: 10,
  helpful: 7,
  notHelpful: 3,
  helpfulRate: 70,
  byType: {
    WAITLIST_MATCH: { helpful: 4, notHelpful: 1, total: 5 },
    RETENTION_DUE: { helpful: 3, notHelpful: 2, total: 5 },
  },
};

describe('AgentPerformance', () => {
  it('renders summary stats', () => {
    render(<AgentPerformance stats={mockStats} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Total Ratings')).toBeInTheDocument();
    expect(screen.getByText('Helpful Rate')).toBeInTheDocument();
    expect(screen.getByText('Agent Types')).toBeInTheDocument();
  });

  it('renders type breakdown table', () => {
    render(<AgentPerformance stats={mockStats} />);
    expect(screen.getByText('Waitlist Matching')).toBeInTheDocument();
    expect(screen.getByText('Patient Retention')).toBeInTheDocument();
  });

  it('shows helpful and not helpful counts', () => {
    render(<AgentPerformance stats={mockStats} />);
    expect(screen.getByText('4')).toBeInTheDocument(); // WAITLIST helpful
    expect(screen.getByText('3')).toBeInTheDocument(); // RETENTION helpful
  });

  it('calculates per-type rate', () => {
    render(<AgentPerformance stats={mockStats} />);
    expect(screen.getByText('80%')).toBeInTheDocument(); // WAITLIST: 4/5 = 80%
    expect(screen.getByText('60%')).toBeInTheDocument(); // RETENTION: 3/5 = 60%
  });

  it('shows empty state when no data', () => {
    render(
      <AgentPerformance
        stats={{ total: 0, helpful: 0, notHelpful: 0, helpfulRate: 0, byType: {} }}
      />,
    );
    expect(screen.getByText('No feedback data yet.')).toBeInTheDocument();
  });

  it('shows raw type when no label mapping', () => {
    render(
      <AgentPerformance
        stats={{
          total: 1,
          helpful: 1,
          notHelpful: 0,
          helpfulRate: 100,
          byType: { CUSTOM_TYPE: { helpful: 1, notHelpful: 0, total: 1 } },
        }}
      />,
    );
    expect(screen.getByText('CUSTOM_TYPE')).toBeInTheDocument();
  });

  it('applies color coding based on rate', () => {
    render(
      <AgentPerformance
        stats={{
          total: 3,
          helpful: 1,
          notHelpful: 2,
          helpfulRate: 33,
          byType: {
            LOW_TYPE: { helpful: 1, notHelpful: 2, total: 3 },
          },
        }}
      />,
    );
    // 33% appears in both summary and table — find the badge by class
    const badges = screen.getAllByText(/33%/);
    const tableBadge = badges.find((el) => el.className.includes('rounded-full'));
    expect(tableBadge?.className).toContain('bg-red-50');
  });
});

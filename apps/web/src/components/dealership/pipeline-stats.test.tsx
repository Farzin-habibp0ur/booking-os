import { render, screen } from '@testing-library/react';
import { PipelineStats } from './pipeline-stats';

const mockStats = {
  totalDeals: 24,
  totalPipelineValue: 480000,
  weightedPipelineValue: 312000,
  winRate: 42,
  avgCycleTime: 14,
  won: 10,
  lost: 14,
};

describe('PipelineStats', () => {
  it('renders all 4 stat cards', () => {
    render(<PipelineStats stats={mockStats} />);

    expect(screen.getByText('Pipeline Value')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg Cycle Time')).toBeInTheDocument();
    expect(screen.getByText('Active Deals')).toBeInTheDocument();
  });

  it('shows formatted pipeline value', () => {
    render(<PipelineStats stats={mockStats} />);

    expect(screen.getByText('$480,000')).toBeInTheDocument();
    expect(screen.getByText('Weighted: $312,000')).toBeInTheDocument();
  });

  it('shows win rate with won/lost breakdown', () => {
    render(<PipelineStats stats={mockStats} />);

    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('10W / 14L')).toBeInTheDocument();
  });

  it('shows avg cycle time in days', () => {
    render(<PipelineStats stats={mockStats} />);

    expect(screen.getByText('14 days')).toBeInTheDocument();
  });

  it('shows total active deals', () => {
    render(<PipelineStats stats={mockStats} />);

    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('returns null when stats is null', () => {
    const { container } = render(<PipelineStats stats={null} />);

    expect(container.innerHTML).toBe('');
  });
});

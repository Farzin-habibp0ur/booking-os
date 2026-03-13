// @ts-nocheck
jest.mock('@/lib/cn', () => ({ cn: (...args) => args.filter(Boolean).join(' ') }));
jest.mock('lucide-react', () => ({
  Search: () => <span data-testid="search-icon" />,
  Edit3: () => <span data-testid="edit-icon" />,
  FileText: () => <span data-testid="file-icon" />,
  Eye: () => <span data-testid="eye-icon" />,
  Send: () => <span data-testid="send-icon" />,
  BarChart3: () => <span data-testid="chart-icon" />,
}));

import { render, screen } from '@testing-library/react';
import { PipelineVisualization, PipelineStageCounts } from './pipeline-visualization';

const mockCounts: PipelineStageCounts = {
  research: 5,
  creation: 3,
  queue: 8,
  approve: 12,
  publish: 2,
  analyze: 4,
};

describe('PipelineVisualization', () => {
  it('renders with data-testid', () => {
    render(<PipelineVisualization stageCounts={mockCounts} />);
    expect(screen.getByTestId('pipeline-visualization')).toBeInTheDocument();
  });

  it('renders all 6 stages', () => {
    render(<PipelineVisualization stageCounts={mockCounts} />);
    expect(screen.getByTestId('stage-research')).toBeInTheDocument();
    expect(screen.getByTestId('stage-creation')).toBeInTheDocument();
    expect(screen.getByTestId('stage-queue')).toBeInTheDocument();
    expect(screen.getByTestId('stage-approve')).toBeInTheDocument();
    expect(screen.getByTestId('stage-publish')).toBeInTheDocument();
    expect(screen.getByTestId('stage-analyze')).toBeInTheDocument();
  });

  it('shows stage labels', () => {
    render(<PipelineVisualization stageCounts={mockCounts} />);
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('Creation')).toBeInTheDocument();
    expect(screen.getByText('Queue')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
    expect(screen.getByText('Analyze')).toBeInTheDocument();
  });

  it('shows counts for each stage', () => {
    render(<PipelineVisualization stageCounts={mockCounts} />);
    expect(screen.getByTestId('count-research')).toHaveTextContent('5');
    expect(screen.getByTestId('count-approve')).toHaveTextContent('12');
    expect(screen.getByTestId('count-analyze')).toHaveTextContent('4');
  });

  it('highlights active stage with lavender', () => {
    render(<PipelineVisualization stageCounts={mockCounts} activeStage="approve" />);
    const stage = screen.getByTestId('stage-approve');
    expect(stage.className).toContain('scale-105');
  });

  it('does not highlight non-active stages', () => {
    render(<PipelineVisualization stageCounts={mockCounts} activeStage="approve" />);
    const stage = screen.getByTestId('stage-research');
    expect(stage.className).not.toContain('scale-105');
  });

  it('shows 0 for stages with no count', () => {
    render(<PipelineVisualization stageCounts={{ ...mockCounts, publish: 0 }} />);
    expect(screen.getByTestId('count-publish')).toHaveTextContent('0');
  });

  it('applies custom className', () => {
    render(<PipelineVisualization stageCounts={mockCounts} className="custom" />);
    expect(screen.getByTestId('pipeline-visualization').className).toContain('custom');
  });
});

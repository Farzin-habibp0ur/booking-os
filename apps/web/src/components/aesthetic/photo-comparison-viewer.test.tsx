import { render, screen } from '@testing-library/react';
import { PhotoComparisonViewer } from './photo-comparison-viewer';

const mockComparisons = [
  {
    id: 'comp1',
    bodyArea: 'face',
    notes: 'Great improvement',
    createdAt: '2026-02-20T12:00:00Z',
    beforePhoto: {
      id: 'p1',
      type: 'BEFORE',
      bodyArea: 'face',
      fileUrl: '/file/p1.jpg',
      takenAt: '2026-01-15T12:00:00Z',
    },
    afterPhoto: {
      id: 'p2',
      type: 'AFTER',
      bodyArea: 'face',
      fileUrl: '/file/p2.jpg',
      takenAt: '2026-02-15T12:00:00Z',
    },
  },
];

describe('PhotoComparisonViewer', () => {
  it('renders empty state when no comparisons', () => {
    render(<PhotoComparisonViewer comparisons={[]} />);
    expect(screen.getByText('No comparisons yet')).toBeInTheDocument();
  });

  it('renders comparison cards', () => {
    render(<PhotoComparisonViewer comparisons={mockComparisons} />);
    expect(screen.getByTestId('comparison-viewer')).toBeInTheDocument();
    expect(screen.getAllByTestId('comparison-card')).toHaveLength(1);
  });

  it('shows body area label', () => {
    render(<PhotoComparisonViewer comparisons={mockComparisons} />);
    expect(screen.getByText('Face')).toBeInTheDocument();
  });

  it('shows notes', () => {
    render(<PhotoComparisonViewer comparisons={mockComparisons} />);
    expect(screen.getByText('Great improvement')).toBeInTheDocument();
  });

  it('shows before/after labels', () => {
    render(<PhotoComparisonViewer comparisons={mockComparisons} />);
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
  });

  it('renders slider element', () => {
    render(<PhotoComparisonViewer comparisons={mockComparisons} />);
    expect(screen.getByTestId('comparison-slider')).toBeInTheDocument();
  });

  it('shows date info', () => {
    render(<PhotoComparisonViewer comparisons={mockComparisons} />);
    // Dates should be rendered
    expect(screen.getByText(/Before:/)).toBeInTheDocument();
    expect(screen.getByText(/After:/)).toBeInTheDocument();
  });
});

// @ts-nocheck
jest.mock('@/lib/cn', () => ({ cn: (...args) => args.filter(Boolean).join(' ') }));
jest.mock('lucide-react', () => ({
  Check: () => <span data-testid="check-icon" />,
  X: () => <span data-testid="x-icon" />,
  ChevronDown: () => <span data-testid="chevron-down" />,
  ChevronUp: () => <span data-testid="chevron-up" />,
  Sparkles: () => <span data-testid="sparkles-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { ContentDraftCard, ContentDraft } from './content-draft-card';

const mockDraft: ContentDraft = {
  id: 'draft-1',
  title: 'SEO Guide for Clinics',
  body: 'This is the body content of the draft that goes on for a while to test truncation and word count.',
  contentType: 'BLOG_POST',
  tier: 'GREEN',
  pillar: 'Product_Education',
  platform: 'BLOG',
  agentId: 'MKT_BLOG_WRITER',
  qualityScore: 82,
  currentGate: 'GATE_3',
  createdAt: '2027-01-15T12:00:00Z',
  metadata: { keywords: ['seo', 'clinic'] },
  rejectionLogs: [
    {
      id: 'rl-1',
      gate: 'GATE_2',
      rejectionCode: 'R02',
      reason: 'Quality too low',
      severity: 'MAJOR',
      createdAt: '2027-01-14T12:00:00Z',
    },
  ],
};

const baseProps = {
  draft: mockDraft,
  isExpanded: false,
  isSelected: false,
  onApprove: jest.fn(),
  onReject: jest.fn(),
  onExpand: jest.fn(),
  onSelect: jest.fn(),
};

describe('ContentDraftCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders with data-testid', () => {
    render(<ContentDraftCard {...baseProps} />);
    expect(screen.getByTestId('content-draft-card')).toBeInTheDocument();
  });

  it('shows draft title', () => {
    render(<ContentDraftCard {...baseProps} />);
    expect(screen.getByText('SEO Guide for Clinics')).toBeInTheDocument();
  });

  it('shows tier badge', () => {
    render(<ContentDraftCard {...baseProps} />);
    expect(screen.getByTestId('tier-badge')).toHaveTextContent('GREEN');
  });

  it('shows content type badge', () => {
    render(<ContentDraftCard {...baseProps} />);
    expect(screen.getByText('Blog Post')).toBeInTheDocument();
  });

  it('shows platform badge', () => {
    render(<ContentDraftCard {...baseProps} />);
    expect(screen.getByText('BLOG')).toBeInTheDocument();
  });

  it('shows agent badge', () => {
    render(<ContentDraftCard {...baseProps} />);
    expect(screen.getByText('MKT_BLOG_WRITER')).toBeInTheDocument();
  });

  it('shows quality score', () => {
    render(<ContentDraftCard {...baseProps} />);
    expect(screen.getByTestId('quality-score')).toHaveTextContent('Q: 82');
  });

  it('shows quality score with green for >=80', () => {
    render(<ContentDraftCard {...baseProps} />);
    expect(screen.getByTestId('quality-score').className).toContain('bg-green-50');
  });

  it('shows quality score with amber for 50-79', () => {
    render(<ContentDraftCard {...baseProps} draft={{ ...mockDraft, qualityScore: 65 }} />);
    expect(screen.getByTestId('quality-score').className).toContain('bg-amber-50');
  });

  it('shows quality score with red for <50', () => {
    render(<ContentDraftCard {...baseProps} draft={{ ...mockDraft, qualityScore: 30 }} />);
    expect(screen.getByTestId('quality-score').className).toContain('bg-red-50');
  });

  it('shows pillar name', () => {
    render(<ContentDraftCard {...baseProps} />);
    expect(screen.getByText('Product Education')).toBeInTheDocument();
  });

  it('shows word count', () => {
    render(<ContentDraftCard {...baseProps} />);
    const words = mockDraft.body.split(/\s+/).length;
    expect(screen.getByText(`${words} words`)).toBeInTheDocument();
  });

  it('shows gate info', () => {
    render(<ContentDraftCard {...baseProps} />);
    expect(screen.getByText('GATE 3')).toBeInTheDocument();
  });

  it('calls onApprove when approve clicked', () => {
    render(<ContentDraftCard {...baseProps} />);
    fireEvent.click(screen.getByTestId('approve-btn'));
    expect(baseProps.onApprove).toHaveBeenCalledTimes(1);
  });

  it('calls onReject when reject clicked', () => {
    render(<ContentDraftCard {...baseProps} />);
    fireEvent.click(screen.getByTestId('reject-btn'));
    expect(baseProps.onReject).toHaveBeenCalledTimes(1);
  });

  it('calls onExpand when expand clicked', () => {
    render(<ContentDraftCard {...baseProps} />);
    fireEvent.click(screen.getByTestId('expand-btn'));
    expect(baseProps.onExpand).toHaveBeenCalledTimes(1);
  });

  it('shows checkbox and calls onSelect', () => {
    render(<ContentDraftCard {...baseProps} />);
    fireEvent.click(screen.getByTestId('draft-checkbox'));
    expect(baseProps.onSelect).toHaveBeenCalledTimes(1);
  });

  it('does not show expanded content when collapsed', () => {
    render(<ContentDraftCard {...baseProps} isExpanded={false} />);
    expect(screen.queryByTestId('expanded-content')).not.toBeInTheDocument();
  });

  it('shows expanded content with full body', () => {
    render(<ContentDraftCard {...baseProps} isExpanded={true} />);
    expect(screen.getByTestId('expanded-content')).toBeInTheDocument();
    expect(screen.getByText('Full Content')).toBeInTheDocument();
  });

  it('shows rejection history in expanded view', () => {
    render(<ContentDraftCard {...baseProps} isExpanded={true} />);
    expect(screen.getByTestId('rejection-history')).toBeInTheDocument();
    expect(screen.getByText('Quality too low')).toBeInTheDocument();
    expect(screen.getByText('R02')).toBeInTheDocument();
  });

  it('shows metadata in expanded view', () => {
    render(<ContentDraftCard {...baseProps} isExpanded={true} />);
    expect(screen.getByText('Metadata')).toBeInTheDocument();
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
  },
}));

jest.mock('lucide-react', () => ({
  FileText: (props: any) => <div data-testid="file-text-icon" {...props} />,
  Check: (props: any) => <div data-testid="check-icon" {...props} />,
  X: (props: any) => <div data-testid="x-icon" {...props} />,
  ChevronDown: (props: any) => <div data-testid="chevron-down" {...props} />,
  ChevronUp: (props: any) => <div data-testid="chevron-up" {...props} />,
  Filter: (props: any) => <div data-testid="filter-icon" {...props} />,
  Sparkles: (props: any) => <div data-testid="sparkles-icon" {...props} />,
  Clock: (props: any) => <div data-testid="clock-icon" {...props} />,
  Search: (props: any) => <div data-testid="search-icon" {...props} />,
  Beaker: (props: any) => <div data-testid="beaker-icon" {...props} />,
  Send: (props: any) => <div data-testid="send-icon" {...props} />,
  BarChart3: (props: any) => <div data-testid="bar-chart" {...props} />,
  Eye: (props: any) => <div data-testid="eye-icon" {...props} />,
  Edit3: (props: any) => <div data-testid="edit3-icon" {...props} />,
}));

import ContentQueuePage from './page';

const mockDrafts = [
  {
    id: 'cd1',
    title: 'Test Blog Post',
    body: 'This is the body of a test blog post about AI.',
    contentType: 'BLOG_POST',
    channel: 'BLOG',
    pillar: 'INDUSTRY_INSIGHTS',
    status: 'IN_REVIEW',
    tier: 'YELLOW',
    agentId: 'blog-writer',
    qualityScore: 78,
    currentGate: 'GATE_3',
    platform: 'BLOG',
    metadata: {},
    rejectionLogs: [],
    createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'cd2',
    title: 'Social Media Update',
    body: 'Check out our latest feature!',
    contentType: 'SOCIAL_POST',
    channel: 'INSTAGRAM',
    status: 'IN_REVIEW',
    tier: 'GREEN',
    qualityScore: 92,
    currentGate: 'GATE_4',
    platform: 'INSTAGRAM',
    metadata: {},
    rejectionLogs: [],
    createdAt: '2026-03-02T10:00:00Z',
  },
];

const mockStats = {
  byStatus: { DRAFT: 2, IN_REVIEW: 5, APPROVED: 3, PUBLISHED: 2, REJECTED: 1 },
  byTier: { GREEN: 3, YELLOW: 5, RED: 2 },
  byContentType: { BLOG_POST: 4, SOCIAL_POST: 6 },
  byPillar: { INDUSTRY_INSIGHTS: 3, PRODUCT_EDUCATION: 4, SUCCESS_STORIES: 2, ENGAGEMENT: 1 },
};

const mockPillarBalance = [
  { pillar: 'INDUSTRY_INSIGHTS', count: 3, percentage: 30, target: 25 },
  { pillar: 'PRODUCT_EDUCATION', count: 4, percentage: 40, target: 30 },
  { pillar: 'SUCCESS_STORIES', count: 2, percentage: 20, target: 25 },
  { pillar: 'ENGAGEMENT', count: 1, percentage: 10, target: 10 },
  { pillar: 'THOUGHT_LEADERSHIP', count: 0, percentage: 0, target: 10 },
];

describe('ContentQueuePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/marketing-content/stats')) return Promise.resolve(mockStats);
      if (url.includes('/marketing-content/pillar-balance'))
        return Promise.resolve(mockPillarBalance);
      if (url.includes('/marketing-content'))
        return Promise.resolve({ data: mockDrafts, total: 2 });
      return Promise.resolve([]);
    });
    mockPost.mockResolvedValue({});
  });

  it('renders the page with title', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByText('Content Queue')).toBeInTheDocument();
    });
  });

  it('renders pipeline visualization with stage counts', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('pipeline-viz')).toBeInTheDocument();
    });
  });

  it('renders draft cards with tier badges', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Blog Post')).toBeInTheDocument();
    });

    expect(screen.getByText('Social Media Update')).toBeInTheDocument();
    expect(screen.getAllByTestId('draft-card')).toHaveLength(2);
  });

  it('shows tier-colored badges', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('tier-badge').length).toBe(2);
    });

    expect(screen.getByText('YELLOW')).toBeInTheDocument();
    expect(screen.getByText('GREEN')).toBeInTheDocument();
  });

  it('shows quality scores on draft cards', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByText('Q: 78')).toBeInTheDocument();
      expect(screen.getByText('Q: 92')).toBeInTheDocument();
    });
  });

  it('shows approve and reject buttons for review drafts', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('approve-btn').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('reject-btn').length).toBeGreaterThan(0);
    });
  });

  it('calls review endpoint with approve when approve clicked', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('approve-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('approve-btn')[0]);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/marketing-content/cd1/review',
        expect.objectContaining({ action: 'approve' }),
      );
    });
  });

  it('shows reject form with rejection code dropdown', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('reject-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('reject-btn')[0]);

    expect(screen.getByTestId('reject-form')).toBeInTheDocument();
    expect(screen.getByTestId('reject-code-select')).toBeInTheDocument();
    expect(screen.getByTestId('reject-reason-input')).toBeInTheDocument();
  });

  it('submits rejection with code and reason', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('reject-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('reject-btn')[0]);
    fireEvent.change(screen.getByTestId('reject-code-select'), {
      target: { value: 'R01' },
    });
    fireEvent.change(screen.getByTestId('reject-reason-input'), {
      target: { value: 'Needs more detail' },
    });
    fireEvent.click(screen.getByTestId('confirm-reject-btn'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/marketing-content/cd1/review',
        expect.objectContaining({
          action: 'reject',
          rejectionCode: 'R01',
          reason: 'Needs more detail',
        }),
      );
    });
  });

  it('expands draft to show full content', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('expand-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('expand-btn')[0]);

    expect(screen.getByTestId('expanded-content')).toBeInTheDocument();
  });

  it('renders filter bar with tier buttons and dropdowns', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('filter-bar')).toBeInTheDocument();
    });

    expect(screen.getByTestId('content-type-filter')).toBeInTheDocument();
    expect(screen.getByTestId('channel-filter')).toBeInTheDocument();
  });

  it('shows bulk actions when items selected', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('draft-checkbox')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('draft-checkbox')[0]);

    expect(screen.getByTestId('bulk-actions')).toBeInTheDocument();
    expect(screen.getByText('Approve All')).toBeInTheDocument();
  });

  it('calls bulk review when Approve All clicked', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('draft-checkbox')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('draft-checkbox')[0]);
    fireEvent.click(screen.getByText('Approve All'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/marketing-content/bulk-review',
        expect.objectContaining({
          ids: ['cd1'],
          action: 'approve',
        }),
      );
    });
  });

  it('renders pillar balance sidebar', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('pillar-sidebar')).toBeInTheDocument();
      expect(screen.getByText('Pillar Balance')).toBeInTheDocument();
    });
  });

  it('shows empty state when no drafts', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/marketing-content/stats'))
        return Promise.resolve({ byStatus: {}, byTier: {}, byContentType: {}, byPillar: {} });
      if (url.includes('/marketing-content/pillar-balance')) return Promise.resolve([]);
      return Promise.resolve({ data: [], total: 0 });
    });

    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });
});

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
  CheckCircle2: (props: any) => <div data-testid="check-circle" {...props} />,
  XCircle: (props: any) => <div data-testid="x-circle" {...props} />,
  Calendar: (props: any) => <div data-testid="calendar-icon" {...props} />,
  Send: (props: any) => <div data-testid="send-icon" {...props} />,
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
    status: 'PENDING_REVIEW',
    agentId: 'blog-writer',
    createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'cd2',
    title: 'Social Media Update',
    body: 'Check out our latest feature!',
    contentType: 'SOCIAL_POST',
    channel: 'TWITTER',
    status: 'APPROVED',
    createdAt: '2026-03-02T10:00:00Z',
  },
];

const mockStats = {
  byStatus: { PENDING_REVIEW: 5, APPROVED: 3, PUBLISHED: 2 },
  byContentType: { BLOG_POST: 4, SOCIAL_POST: 6 },
  byChannel: { BLOG: 4, TWITTER: 6 },
};

describe('ContentQueuePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/content-queue/stats')) return Promise.resolve(mockStats);
      return Promise.resolve({ data: mockDrafts, total: 2 });
    });
    mockPost.mockResolvedValue({});
  });

  it('renders the page with title and stats', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByText('Content Queue')).toBeInTheDocument();
      const statsStrip = screen.getByTestId('stats-strip');
      expect(statsStrip.textContent).toContain('5');
    });

    const statsStrip = screen.getByTestId('stats-strip');
    expect(statsStrip.textContent).toContain('3');
    expect(statsStrip.textContent).toContain('2');
  });

  it('renders draft cards with badges', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Blog Post')).toBeInTheDocument();
    });

    expect(screen.getByText('Social Media Update')).toBeInTheDocument();
    expect(screen.getAllByTestId('draft-card')).toHaveLength(2);
    expect(screen.getAllByText('Blog Post').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Blog').length).toBeGreaterThan(0);
  });

  it('shows AI Generated badge for agent-created drafts', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByText('AI Generated')).toBeInTheDocument();
    });
  });

  it('shows approve and reject buttons for pending drafts', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('approve-btn')).toBeInTheDocument();
      expect(screen.getByTestId('reject-btn')).toBeInTheDocument();
    });
  });

  it('calls approve endpoint when approve button clicked', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('approve-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('approve-btn'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/content-queue/cd1/approve', {});
    });
  });

  it('shows reject form when reject button clicked', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('reject-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('reject-btn'));

    expect(screen.getByTestId('reject-form')).toBeInTheDocument();
    expect(screen.getByTestId('reject-note-input')).toBeInTheDocument();
  });

  it('submits rejection with note', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('reject-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('reject-btn'));
    fireEvent.change(screen.getByTestId('reject-note-input'), {
      target: { value: 'Needs more detail' },
    });
    fireEvent.click(screen.getByTestId('confirm-reject-btn'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/content-queue/cd1/reject', {
        reviewNote: 'Needs more detail',
      });
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

  it('filters by status when chip clicked', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Pending'));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('status=PENDING_REVIEW'));
    });
  });

  it('shows bulk actions when items selected', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('draft-checkbox')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('draft-checkbox')[0]);

    expect(screen.getByTestId('bulk-actions')).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByText('Approve All')).toBeInTheDocument();
  });

  it('calls bulk approve when Approve All clicked', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('draft-checkbox')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('draft-checkbox')[0]);
    fireEvent.click(screen.getByText('Approve All'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/content-queue/bulk-approve', {
        ids: ['cd1'],
      });
    });
  });

  it('shows empty state when no drafts', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/content-queue/stats'))
        return Promise.resolve({ byStatus: {}, byContentType: {}, byChannel: {} });
      return Promise.resolve({ data: [], total: 0 });
    });

    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByText('No content drafts')).toBeInTheDocument();
    });
  });

  it('renders filter bar with dropdowns', async () => {
    render(<ContentQueuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('filter-bar')).toBeInTheDocument();
    });

    expect(screen.getByTestId('content-type-filter')).toBeInTheDocument();
    expect(screen.getByTestId('channel-filter')).toBeInTheDocument();
  });
});

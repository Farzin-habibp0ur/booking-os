jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('lucide-react', () => ({
  FileEdit: (props: Record<string, unknown>) => <div data-testid="file-edit-icon" {...props} />,
  CheckCircle: (props: Record<string, unknown>) => (
    <div data-testid="check-circle-icon" {...props} />
  ),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

import { render, screen, waitFor } from '@testing-library/react';
import { api } from '@/lib/api';
import { PendingDraftsCard } from './pending-drafts-card';

const mockGet = api.get as jest.Mock;

describe('PendingDraftsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows count when drafts exist', async () => {
    mockGet.mockResolvedValue([{}, {}, {}, {}, {}]);

    render(<PendingDraftsCard />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    expect(screen.getByText('drafts waiting for review')).toBeInTheDocument();
  });

  it('shows "All caught up" when no drafts', async () => {
    mockGet.mockResolvedValue([]);

    render(<PendingDraftsCard />);

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    expect(screen.getByText('All caught up! No drafts pending.')).toBeInTheDocument();
  });

  it('shows "Review in Inbox" link pointing to /inbox when count > 0', async () => {
    mockGet.mockResolvedValue([{}, {}, {}]);

    render(<PendingDraftsCard />);

    await waitFor(() => {
      expect(screen.getByText('Review in Inbox →')).toBeInTheDocument();
    });

    const link = screen.getByText('Review in Inbox →').closest('a');
    expect(link).toHaveAttribute('href', '/inbox');
  });

  it('shows loading skeleton while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    render(<PendingDraftsCard />);

    const card = screen.getByTestId('pending-drafts-card');
    expect(card.className).toContain('animate-pulse');
  });

  it('handles API error gracefully (shows 0, no crash)', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    render(<PendingDraftsCard />);

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    expect(screen.getByText('All caught up! No drafts pending.')).toBeInTheDocument();
  });

  it('renders with correct data-testid', async () => {
    mockGet.mockResolvedValue([]);

    render(<PendingDraftsCard />);

    expect(screen.getByTestId('pending-drafts-card')).toBeInTheDocument();
  });

  it('renders Pending AI Drafts title', async () => {
    mockGet.mockResolvedValue([]);

    render(<PendingDraftsCard />);

    await waitFor(() => {
      expect(screen.getByText('Pending AI Drafts')).toBeInTheDocument();
    });
  });

  it('calls GET /outbound?status=DRAFT&take=100 on mount', async () => {
    mockGet.mockResolvedValue([]);

    render(<PendingDraftsCard />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/outbound?status=DRAFT&take=100');
    });
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BriefingFeed } from './briefing-feed';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockGet = jest.fn();
const mockPatch = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}));

const mockBriefing = {
  groups: [
    {
      category: 'URGENT_TODAY',
      label: 'Urgent Today',
      cards: [
        {
          id: 'card-1',
          type: 'DEPOSIT_PENDING',
          category: 'URGENT_TODAY',
          priority: 90,
          title: 'Deposit pending',
          description: 'Needs deposit',
          suggestedAction: 'Send reminder',
          status: 'PENDING',
          autonomyLevel: 'ASSISTED',
          customer: { id: 'c1', name: 'Emma' },
          createdAt: new Date().toISOString(),
        },
      ],
    },
    {
      category: 'OPPORTUNITY',
      label: 'Opportunities',
      cards: [
        {
          id: 'opp-1',
          type: 'OPEN_SLOT',
          category: 'OPPORTUNITY',
          priority: 55,
          title: '3 open slots',
          description: 'Gaps tomorrow',
          suggestedAction: 'Notify waitlist',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        },
      ],
    },
  ],
  totalPending: 2,
  urgentCount: 1,
  lastRefreshed: new Date().toISOString(),
};

describe('BriefingFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading skeleton initially', () => {
    mockGet.mockReturnValue(new Promise(() => {})); // never resolves
    render(<BriefingFeed />);

    expect(screen.getByTestId('briefing-loading')).toBeInTheDocument();
  });

  it('renders briefing groups after loading', async () => {
    mockGet.mockResolvedValue(mockBriefing);
    render(<BriefingFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('briefing-feed')).toBeInTheDocument();
    });

    expect(screen.getByText('Daily Briefing')).toBeInTheDocument();
    expect(screen.getByText('1 urgent')).toBeInTheDocument();
    expect(screen.getByTestId('briefing-group-URGENT_TODAY')).toBeInTheDocument();
    expect(screen.getByTestId('briefing-group-OPPORTUNITY')).toBeInTheDocument();
  });

  it('renders urgent cards as BriefingCards', async () => {
    mockGet.mockResolvedValue(mockBriefing);
    render(<BriefingFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('briefing-card-card-1')).toBeInTheDocument();
    });

    expect(screen.getByText('Deposit pending')).toBeInTheDocument();
  });

  it('renders opportunity cards as OpportunityCards', async () => {
    mockGet.mockResolvedValue(mockBriefing);
    render(<BriefingFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('opportunity-card-opp-1')).toBeInTheDocument();
    });

    expect(screen.getByText('3 open slots')).toBeInTheDocument();
  });

  it('shows error state and retry button', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    render(<BriefingFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('briefing-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByTestId('briefing-retry')).toBeInTheDocument();
  });

  it('retries loading on retry click', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));
    render(<BriefingFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('briefing-error')).toBeInTheDocument();
    });

    mockGet.mockResolvedValue(mockBriefing);
    fireEvent.click(screen.getByTestId('briefing-retry'));

    await waitFor(() => {
      expect(screen.getByTestId('briefing-feed')).toBeInTheDocument();
    });

    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('shows empty state when no pending cards', async () => {
    mockGet.mockResolvedValue({
      groups: [],
      totalPending: 0,
      urgentCount: 0,
      lastRefreshed: new Date().toISOString(),
    });
    render(<BriefingFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('briefing-empty')).toBeInTheDocument();
    });

    expect(screen.getByText('All clear')).toBeInTheDocument();
  });

  it('approves a card and refreshes', async () => {
    mockGet.mockResolvedValue(mockBriefing);
    mockPatch.mockResolvedValue({ id: 'card-1', status: 'APPROVED' });
    render(<BriefingFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('briefing-approve-card-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('briefing-approve-card-1'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/action-cards/card-1/approve');
    });

    expect(mockToast).toHaveBeenCalledWith('Action approved', 'success');
  });

  it('dismisses a card and refreshes', async () => {
    mockGet.mockResolvedValue(mockBriefing);
    mockPatch.mockResolvedValue({ id: 'card-1', status: 'DISMISSED' });
    render(<BriefingFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('briefing-dismiss-card-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('briefing-dismiss-card-1'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/action-cards/card-1/dismiss');
    });

    expect(mockToast).toHaveBeenCalledWith('Card dismissed', 'success');
  });

  it('shows error toast when approve fails', async () => {
    mockGet.mockResolvedValue(mockBriefing);
    mockPatch.mockRejectedValue(new Error('Approval failed'));
    render(<BriefingFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('briefing-approve-card-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('briefing-approve-card-1'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Approval failed', 'error');
    });
  });

  it('calls onCardAction when opportunity card clicked', async () => {
    mockGet.mockResolvedValue(mockBriefing);
    const onCardAction = jest.fn();
    render(<BriefingFeed onCardAction={onCardAction} />);

    await waitFor(() => {
      expect(screen.getByTestId('opportunity-card-opp-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('opportunity-card-opp-1'));

    expect(onCardAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'opp-1' }));
  });

  it('refreshes when refresh button clicked', async () => {
    mockGet.mockResolvedValue(mockBriefing);
    render(<BriefingFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('briefing-feed')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('briefing-refresh'));

    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

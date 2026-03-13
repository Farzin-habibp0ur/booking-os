const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    patch: (...args: any[]) => mockPatch(...args),
    post: (...args: any[]) => mockPost(...args),
  },
}));
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));
jest.mock('@/lib/use-socket', () => ({
  getGlobalSocket: () => null,
}));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AIActionsPage from './page';

const mockBriefingItems = [
  {
    id: 'card-1',
    title: 'Re-engage Alice Johnson',
    description: 'Customer has not visited in 90 days',
    priority: 'URGENT_TODAY',
    sourceAgent: 'RETENTION',
    quickActions: ['approve', 'dismiss', 'snooze', 'expand'],
    createdAt: '2026-03-09T10:00:00Z',
  },
  {
    id: 'card-2',
    title: 'Possible duplicate customer',
    description: 'Two records share the same phone number',
    priority: 'HYGIENE',
    sourceAgent: 'DATA_HYGIENE',
    quickActions: ['approve', 'dismiss', 'snooze', 'expand'],
    createdAt: '2026-03-09T09:00:00Z',
  },
  {
    id: 'card-3',
    title: 'Schedule gap detected',
    description: '2-hour gap on Thursday afternoon could be filled',
    priority: 'OPPORTUNITY',
    sourceAgent: 'SCHEDULING_OPTIMIZER',
    quickActions: ['approve', 'dismiss', 'snooze', 'expand'],
    createdAt: '2026-03-09T08:00:00Z',
  },
];

describe('AIActionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/dashboard-briefing/briefing')) return Promise.resolve(mockBriefingItems);
      return Promise.resolve([]);
    });
    mockPost.mockResolvedValue({});
    mockPatch.mockResolvedValue({});
  });

  it('renders action cards grouped by priority', async () => {
    render(<AIActionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('category-urgent_today')).toBeInTheDocument();
      expect(screen.getByTestId('category-opportunity')).toBeInTheDocument();
      expect(screen.getByTestId('category-hygiene')).toBeInTheDocument();
    });
  });

  it('renders priority headers with labels', async () => {
    render(<AIActionsPage />);
    await waitFor(() => {
      expect(screen.getByText('Urgent')).toBeInTheDocument();
      expect(screen.getByText('Opportunity')).toBeInTheDocument();
      expect(screen.getByText('Hygiene')).toBeInTheDocument();
    });
  });

  it('renders action cards with title and description', async () => {
    render(<AIActionsPage />);
    await waitFor(() => {
      expect(screen.getByText('Re-engage Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Customer has not visited in 90 days')).toBeInTheDocument();
    });
  });

  it('executes approve action via dashboard-briefing endpoint', async () => {
    render(<AIActionsPage />);
    await waitFor(() => screen.getByTestId('approve-card-1'));

    fireEvent.click(screen.getByTestId('approve-card-1'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/dashboard-briefing/briefing/card-1/action', {
        action: 'approve',
      });
    });
  });

  it('executes dismiss action', async () => {
    render(<AIActionsPage />);
    await waitFor(() => screen.getByTestId('dismiss-card-1'));

    fireEvent.click(screen.getByTestId('dismiss-card-1'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/dashboard-briefing/briefing/card-1/action', {
        action: 'dismiss',
      });
    });
  });

  it('executes snooze action', async () => {
    render(<AIActionsPage />);
    await waitFor(() => screen.getByTestId('snooze-card-1'));

    fireEvent.click(screen.getByTestId('snooze-card-1'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/dashboard-briefing/briefing/card-1/action', {
        action: 'snooze',
      });
    });
  });

  it('shows empty state when no pending cards', async () => {
    mockGet.mockResolvedValue([]);

    render(<AIActionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('actions-empty')).toBeInTheDocument();
      expect(screen.getByText('All caught up!')).toBeInTheDocument();
    });
  });

  it('shows view toggle with list and kanban options', async () => {
    render(<AIActionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('view-list')).toBeInTheDocument();
      expect(screen.getByTestId('view-kanban')).toBeInTheDocument();
    });
  });

  it('switches to kanban view', async () => {
    render(<AIActionsPage />);
    await waitFor(() => screen.getByTestId('view-kanban'));

    fireEvent.click(screen.getByTestId('view-kanban'));

    await waitFor(() => {
      expect(screen.getByTestId('kanban-view')).toBeInTheDocument();
    });
  });

  it('shows bulk action bar when cards are selected', async () => {
    render(<AIActionsPage />);
    await waitFor(() => screen.getByTestId('action-card-card-1'));

    const checkbox = screen.getByLabelText('Select Re-engage Alice Johnson');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-bar')).toBeInTheDocument();
      expect(screen.getByText('1 selected')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-approve')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-dismiss')).toBeInTheDocument();
    });
  });

  it('falls back to action-cards when briefing returns empty', async () => {
    const fallbackCards = [
      {
        id: 'fb-1',
        agentType: 'WAITLIST',
        category: 'CONTENT_REVIEW',
        type: 'REVIEW',
        title: 'Fallback card',
        description: 'From action-cards endpoint',
        priority: 65,
        status: 'PENDING',
        createdAt: '2026-03-09T10:00:00Z',
      },
    ];

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/dashboard-briefing/briefing')) return Promise.reject(new Error('fail'));
      if (url.includes('/action-cards')) return Promise.resolve({ data: fallbackCards });
      return Promise.resolve([]);
    });

    render(<AIActionsPage />);
    await waitFor(() => {
      expect(screen.getByText('Fallback card')).toBeInTheDocument();
    });
  });
});

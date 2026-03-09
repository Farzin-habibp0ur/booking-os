const mockGet = jest.fn();
const mockPatch = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}));
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => mockToast,
}));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AIActionsPage from './page';

const mockCards = [
  {
    id: 'card-1',
    agentType: 'RETENTION',
    category: 'urgent',
    type: 'WIN_BACK',
    title: 'Re-engage Alice Johnson',
    description: 'Customer has not visited in 90 days',
    entityType: 'CUSTOMER',
    entityId: 'cust-1',
    confidence: 0.92,
    status: 'PENDING',
    createdAt: '2026-03-09T10:00:00Z',
  },
  {
    id: 'card-2',
    agentType: 'DATA_HYGIENE',
    category: 'hygiene',
    type: 'DUPLICATE',
    title: 'Possible duplicate customer',
    description: 'Two records share the same phone number',
    confidence: 0.78,
    status: 'PENDING',
    createdAt: '2026-03-09T09:00:00Z',
  },
  {
    id: 'card-3',
    agentType: 'SCHEDULING_OPTIMIZER',
    category: 'opportunity',
    type: 'GAP',
    title: 'Schedule gap detected',
    description: '2-hour gap on Thursday afternoon could be filled',
    confidence: 0.85,
    status: 'PENDING',
    createdAt: '2026-03-09T08:00:00Z',
  },
];

describe('AIActionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: mockCards, total: 3 });
    mockPatch.mockResolvedValue({});
  });

  it('renders action cards grouped by category', async () => {
    render(<AIActionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('category-urgent')).toBeInTheDocument();
      expect(screen.getByTestId('category-opportunity')).toBeInTheDocument();
      expect(screen.getByTestId('category-hygiene')).toBeInTheDocument();
    });
  });

  it('renders category headers with labels', async () => {
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

  it('shows confidence score on cards', async () => {
    render(<AIActionsPage />);
    await waitFor(() => {
      expect(screen.getByText('92% confidence')).toBeInTheDocument();
    });
  });

  it('approves card on Approve click', async () => {
    render(<AIActionsPage />);
    await waitFor(() => screen.getByTestId('approve-card-1'));

    fireEvent.click(screen.getByTestId('approve-card-1'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/action-cards/card-1/approve', {});
    });
  });

  it('dismisses card on Dismiss click', async () => {
    render(<AIActionsPage />);
    await waitFor(() => screen.getByTestId('dismiss-card-1'));

    fireEvent.click(screen.getByTestId('dismiss-card-1'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/action-cards/card-1/dismiss', {});
    });
  });

  it('snoozes card on Snooze click', async () => {
    render(<AIActionsPage />);
    await waitFor(() => screen.getByTestId('snooze-card-1'));

    fireEvent.click(screen.getByTestId('snooze-card-1'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/action-cards/card-1/snooze',
        expect.objectContaining({ until: expect.any(String) }),
      );
    });
  });

  it('shows empty state when no pending cards', async () => {
    mockGet.mockResolvedValue({ data: [], total: 0 });

    render(<AIActionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('actions-empty')).toBeInTheDocument();
      expect(screen.getByText('All caught up!')).toBeInTheDocument();
    });
  });

  it('shows bulk action bar when cards are selected', async () => {
    render(<AIActionsPage />);
    await waitFor(() => screen.getByTestId('action-card-card-1'));

    // Select first card checkbox
    const checkbox = screen.getByLabelText('Select Re-engage Alice Johnson');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-bar')).toBeInTheDocument();
      expect(screen.getByText('1 selected')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-approve')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-dismiss')).toBeInTheDocument();
    });
  });

  it('bulk approve calls approve for each selected card', async () => {
    render(<AIActionsPage />);
    await waitFor(() => screen.getByTestId('action-card-card-1'));

    fireEvent.click(screen.getByLabelText('Select Re-engage Alice Johnson'));

    await waitFor(() => screen.getByTestId('bulk-approve'));
    fireEvent.click(screen.getByTestId('bulk-approve'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/action-cards/card-1/approve', {});
    });
  });
});

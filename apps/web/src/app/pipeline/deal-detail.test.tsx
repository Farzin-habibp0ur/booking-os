const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'deal-1' }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/design-tokens', () => ({
  DEAL_STAGE_STYLES: {
    INQUIRY: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Inquiry', hex: '#64748b' },
    QUALIFIED: { bg: 'bg-lavender-50', text: 'text-lavender-900', label: 'Qualified', hex: '#9F8ECB' },
    TEST_DRIVE: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Test Drive', hex: '#0ea5e9' },
    NEGOTIATION: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Negotiation', hex: '#f59e0b' },
    FINANCE: { bg: 'bg-sage-50', text: 'text-sage-700', label: 'Finance', hex: '#71907C' },
    CLOSED_WON: { bg: 'bg-green-50', text: 'text-green-700', label: 'Closed Won', hex: '#22c55e' },
    CLOSED_LOST: { bg: 'bg-red-50', text: 'text-red-700', label: 'Closed Lost', hex: '#ef4444' },
  },
  dealStageBadgeClasses: (stage: string) => `badge-${stage}`,
}));
jest.mock('@/components/skeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { api } from '@/lib/api';
import DealDetailPage from './[id]/page';

const mockApi = api as jest.Mocked<typeof api>;

const mockDeal = {
  id: 'deal-1',
  stage: 'NEGOTIATION',
  dealValue: 42000,
  probability: 65,
  source: 'WALK_IN',
  dealType: 'NEW_PURCHASE',
  tradeInValue: 8000,
  expectedCloseDate: '2026-03-20T00:00:00Z',
  actualCloseDate: null,
  lostReason: null,
  notes: 'Interested in financing options',
  createdAt: '2026-02-15T10:00:00Z',
  updatedAt: '2026-03-09T10:00:00Z',
  customer: { id: 'c1', name: 'John Smith', phone: '555-0101', email: 'john@example.com' },
  vehicle: {
    id: 'v1',
    stockNumber: 'AUT-001',
    year: 2025,
    make: 'Toyota',
    model: 'Camry',
    trim: 'XLE',
    askingPrice: 35000,
    status: 'IN_STOCK',
  },
  assignedTo: { id: 's1', name: 'Mike Sales' },
  _count: { activities: 2 },
  stageHistory: [
    {
      id: 'sh-1',
      fromStage: null,
      toStage: 'INQUIRY',
      duration: null,
      notes: null,
      createdAt: '2026-02-15T10:00:00Z',
      changedBy: { id: 's1', name: 'Mike Sales' },
    },
    {
      id: 'sh-2',
      fromStage: 'INQUIRY',
      toStage: 'QUALIFIED',
      duration: 7200,
      notes: 'Customer showed serious interest',
      createdAt: '2026-02-20T10:00:00Z',
      changedBy: { id: 's1', name: 'Mike Sales' },
    },
    {
      id: 'sh-3',
      fromStage: 'QUALIFIED',
      toStage: 'NEGOTIATION',
      duration: 14400,
      notes: null,
      createdAt: '2026-03-01T10:00:00Z',
      changedBy: null,
    },
  ],
  activities: [
    {
      id: 'act-1',
      type: 'CALL',
      description: 'Initial follow-up call',
      scheduledFor: null,
      completedAt: '2026-02-16T14:00:00Z',
      createdAt: '2026-02-16T14:00:00Z',
      createdBy: { id: 's1', name: 'Mike Sales' },
    },
    {
      id: 'act-2',
      type: 'NOTE',
      description: 'Customer wants to compare financing',
      scheduledFor: null,
      completedAt: null,
      createdAt: '2026-03-05T10:00:00Z',
      createdBy: { id: 's1', name: 'Mike Sales' },
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockResolvedValue(mockDeal);
});

describe('DealDetailPage', () => {
  it('shows loading skeleton initially', async () => {
    let resolveGet: any;
    mockApi.get.mockImplementation(
      () => new Promise((resolve) => { resolveGet = resolve; }),
    );

    await act(async () => {
      render(<DealDetailPage />);
    });

    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
  });

  it('renders deal detail with customer name', async () => {
    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      // Customer name appears in header h1 and sidebar
      expect(screen.getAllByText('John Smith').length).toBeGreaterThanOrEqual(1);
    });

    // Verify it shows in the main heading
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('John Smith');
  });

  it('renders stage badge', async () => {
    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      // Negotiation appears in badge and progress bar
      expect(screen.getAllByText('Negotiation').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows vehicle info in header', async () => {
    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/2025 Toyota Camry/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/AUT-001/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows stage progress bar with all 5 active stages', async () => {
    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      // Active stages displayed in progress bar (some may also appear in stage history)
      expect(screen.getAllByText('Inquiry').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Qualified').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Test Drive').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Negotiation').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Finance').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows deal details section', async () => {
    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Deal Details')).toBeInTheDocument();
      expect(screen.getByText('$42,000')).toBeInTheDocument();
      expect(screen.getByText('65%')).toBeInTheDocument();
      expect(screen.getByText('NEW PURCHASE')).toBeInTheDocument();
      expect(screen.getByText('WALK IN')).toBeInTheDocument();
      expect(screen.getByText('$8,000')).toBeInTheDocument();
      expect(screen.getByText('Interested in financing options')).toBeInTheDocument();
    });
  });

  it('shows activity timeline', async () => {
    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Activity')).toBeInTheDocument();
      expect(screen.getByText('Initial follow-up call')).toBeInTheDocument();
      expect(screen.getByText('Customer wants to compare financing')).toBeInTheDocument();
    });
  });

  it('shows stage history', async () => {
    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Stage History')).toBeInTheDocument();
    });
  });

  it('shows Change Stage button that opens modal', async () => {
    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Change Stage')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Change Stage'));
    });

    expect(screen.getByText('New Stage')).toBeInTheDocument();
    expect(screen.getByText('Update Stage')).toBeInTheDocument();
  });

  it('shows Edit button that toggles edit mode', async () => {
    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Edit'));
    });

    // In edit mode, Save button appears
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('shows Add Activity button', async () => {
    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Add Activity')).toBeInTheDocument();
    });
  });

  it('shows salesperson info', async () => {
    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Salesperson')).toBeInTheDocument();
      // Mike Sales appears in salesperson sidebar and in stage history
      expect(screen.getAllByText('Mike Sales').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows customer sidebar with contact info', async () => {
    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getByText('555-0101')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('View Customer Profile →')).toBeInTheDocument();
    });
  });

  it('shows not found state when deal is null', async () => {
    mockApi.get.mockResolvedValue(null);

    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Deal not found')).toBeInTheDocument();
      expect(screen.getByText('Back to Pipeline')).toBeInTheDocument();
    });
  });

  it('shows Back to Pipeline link', async () => {
    await act(async () => {
      render(<DealDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Back to Pipeline')).toBeInTheDocument();
    });
  });
});

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Admin', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/design-tokens', () => ({
  DEAL_STAGE_STYLES: {
    INQUIRY: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Inquiry', hex: '#64748b' },
    QUALIFIED: { bg: 'bg-lavender-50', text: 'text-lavender-900', label: 'Qualified', hex: '#9F8ECB' },
    TEST_DRIVE: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Test Drive', hex: '#0ea5e9' },
    NEGOTIATION: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Negotiation', hex: '#f59e0b' },
    FINANCE: { bg: 'bg-sage-50', text: 'text-sage-700', label: 'Finance', hex: '#71907C' },
  },
  dealStageBadgeClasses: (stage: string) => `badge-${stage}`,
}));
jest.mock('@/components/skeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));
jest.mock('@/components/dealership/pipeline-stats', () => ({
  PipelineStats: ({ stats }: any) =>
    stats ? <div data-testid="pipeline-stats">Stats</div> : null,
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
import PipelinePage from './page';

const mockApi = api as jest.Mocked<typeof api>;

const mockPipelineData = {
  stages: {
    INQUIRY: [
      {
        id: 'deal-1',
        stage: 'INQUIRY',
        dealValue: 35000,
        probability: 20,
        source: 'WALK_IN',
        dealType: 'NEW_PURCHASE',
        notes: null,
        createdAt: '2026-03-01T10:00:00Z',
        updatedAt: '2026-03-10T10:00:00Z',
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
        _count: { activities: 3 },
      },
    ],
    QUALIFIED: [],
    TEST_DRIVE: [
      {
        id: 'deal-2',
        stage: 'TEST_DRIVE',
        dealValue: 52000,
        probability: 50,
        source: 'WEBSITE',
        dealType: 'USED_PURCHASE',
        notes: null,
        createdAt: '2026-02-20T10:00:00Z',
        updatedAt: '2026-03-08T10:00:00Z',
        customer: { id: 'c2', name: 'Jane Doe', phone: '555-0202', email: null },
        vehicle: {
          id: 'v2',
          stockNumber: 'AUT-002',
          year: 2024,
          make: 'BMW',
          model: 'X5',
          trim: null,
          askingPrice: 55000,
          status: 'IN_STOCK',
        },
        assignedTo: null,
        _count: { activities: 1 },
      },
    ],
    NEGOTIATION: [],
    FINANCE: [],
  },
  stageTotals: {
    INQUIRY: { count: 1, value: 35000 },
    QUALIFIED: { count: 0, value: 0 },
    TEST_DRIVE: { count: 1, value: 52000 },
    NEGOTIATION: { count: 0, value: 0 },
    FINANCE: { count: 0, value: 0 },
  },
  totalDeals: 2,
};

const mockStatsData = {
  totalDeals: 2,
  totalPipelineValue: 87000,
  weightedPipelineValue: 33000,
  winRate: 40,
  avgCycleTime: 12,
  won: 4,
  lost: 6,
};

const mockStaff = [
  { id: 's1', name: 'Mike Sales' },
  { id: 's2', name: 'Sarah Rep' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockImplementation((url: string) => {
    if (url === '/deals/pipeline') return Promise.resolve(mockPipelineData);
    if (url === '/deals/stats') return Promise.resolve(mockStatsData);
    if (url === '/staff') return Promise.resolve(mockStaff);
    if (url.startsWith('/vehicles')) return Promise.resolve([]);
    if (url.startsWith('/customers')) return Promise.resolve([]);
    return Promise.resolve(null);
  });
});

describe('PipelinePage', () => {
  it('shows loading skeleton initially', async () => {
    mockApi.get.mockImplementation(
      () => new Promise(() => {}),
    );

    await act(async () => {
      render(<PipelinePage />);
    });

    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
  });

  it('renders pipeline board with columns', async () => {
    await act(async () => {
      render(<PipelinePage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Sales Pipeline')).toBeInTheDocument();
    });

    expect(screen.getByText('Inquiry')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
    expect(screen.getByText('Test Drive')).toBeInTheDocument();
    expect(screen.getByText('Negotiation')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
  });

  it('shows deal cards with customer name, vehicle info, deal value', async () => {
    await act(async () => {
      render(<PipelinePage />);
    });

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument();
    });

    expect(screen.getAllByText('$35,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/2025 Toyota Camry/)).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getAllByText('$52,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/2024 BMW X5/)).toBeInTheDocument();
  });

  it('shows stats section', async () => {
    await act(async () => {
      render(<PipelinePage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('pipeline-stats')).toBeInTheDocument();
    });
  });

  it('shows total deals count in subtitle', async () => {
    await act(async () => {
      render(<PipelinePage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/2 active deals in pipeline/)).toBeInTheDocument();
    });
  });

  it('shows salesperson name on deal card', async () => {
    await act(async () => {
      render(<PipelinePage />);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Mike Sales').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('renders New Deal button that opens modal', async () => {
    await act(async () => {
      render(<PipelinePage />);
    });

    await waitFor(() => {
      expect(screen.getByText('New Deal')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('New Deal'));
    });

    expect(screen.getByText('Create Deal')).toBeInTheDocument();
    expect(screen.getByText('Customer *')).toBeInTheDocument();
  });

  it('renders staff filter dropdown', async () => {
    await act(async () => {
      render(<PipelinePage />);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Filter by salesperson')).toBeInTheDocument();
    });

    expect(screen.getByText('All Salespeople')).toBeInTheDocument();
  });

  it('filters deals by staff when filter is changed', async () => {
    await act(async () => {
      render(<PipelinePage />);
    });

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument();
    });

    const filter = screen.getByLabelText('Filter by salesperson');

    await act(async () => {
      fireEvent.change(filter, { target: { value: 's1' } });
    });

    // John Smith's deal has assignedTo s1, so it stays visible
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    // Jane Doe's deal has no assignedTo, should be hidden
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
  });

  it('shows Refresh button', async () => {
    await act(async () => {
      render(<PipelinePage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });
});

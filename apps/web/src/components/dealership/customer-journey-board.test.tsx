import { render, screen } from '@testing-library/react';
import { CustomerJourneyBoard } from './customer-journey-board';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/design-tokens', () => ({
  DEAL_STAGE_STYLES: {
    INQUIRY: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Inquiry' },
    QUALIFIED: { bg: 'bg-cyan-50', text: 'text-cyan-700', label: 'Qualified' },
    TEST_DRIVE: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Test Drive' },
    NEGOTIATION: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Negotiation' },
    FINANCE: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Finance' },
    CLOSED_WON: { bg: 'bg-green-50', text: 'text-green-700', label: 'Closed Won' },
    CLOSED_LOST: { bg: 'bg-red-50', text: 'text-red-700', label: 'Closed Lost' },
  },
  dealStageBadgeClasses: (stage: string) => `badge-${stage.toLowerCase()}`,
}));

jest.mock('next/link', () => {
  return ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
});

jest.mock('lucide-react', () => ({
  Activity: (props: any) => <span data-testid="icon-activity" {...props} />,
  Car: (props: any) => <span data-testid="icon-car" {...props} />,
  ChevronRight: (props: any) => <span data-testid="icon-chevron" {...props} />,
  DollarSign: (props: any) => <span data-testid="icon-dollar" {...props} />,
  Eye: (props: any) => <span data-testid="icon-eye" {...props} />,
  MapPin: (props: any) => <span data-testid="icon-map" {...props} />,
  TrendingUp: (props: any) => <span data-testid="icon-trending" {...props} />,
  User: (props: any) => <span data-testid="icon-user" {...props} />,
  Zap: (props: any) => <span data-testid="icon-zap" {...props} />,
}));

const mockJourney = {
  customerId: 'c1',
  firstContact: { date: '2026-01-15T10:00:00Z', channel: 'WALK_IN' },
  deals: [
    {
      id: 'd1',
      stage: 'NEGOTIATION',
      dealValue: 42000,
      probability: 60,
      vehicle: {
        id: 'v1',
        year: 2025,
        make: 'Toyota',
        model: 'Camry',
        trim: 'XLE',
        stockNumber: 'AUT-001',
      },
      assignedTo: { id: 's1', name: 'Mike Sales' },
      stageHistory: [
        {
          fromStage: null,
          toStage: 'INQUIRY',
          createdAt: '2026-01-15T10:00:00Z',
          changedBy: null,
        },
        {
          fromStage: 'INQUIRY',
          toStage: 'QUALIFIED',
          createdAt: '2026-01-20T10:00:00Z',
          changedBy: { name: 'Mike Sales' },
        },
        {
          fromStage: 'QUALIFIED',
          toStage: 'NEGOTIATION',
          createdAt: '2026-02-01T10:00:00Z',
          changedBy: { name: 'Mike Sales' },
        },
      ],
      activities: [
        {
          type: 'CALL',
          description: 'Follow-up call',
          createdAt: '2026-01-16T10:00:00Z',
        },
      ],
      createdAt: '2026-01-15T10:00:00Z',
    },
  ],
  testDrives: [
    {
      id: 'td1',
      vehicle: { year: 2025, make: 'Toyota', model: 'Camry' },
      feedback: 'Loved the ride',
      outcome: 'INTERESTED',
      createdAt: '2026-01-18T10:00:00Z',
      booking: { startTime: '2026-01-18T10:00:00Z', status: 'COMPLETED' },
    },
  ],
  vehiclesOfInterest: [
    {
      id: 'v1',
      year: 2025,
      make: 'Toyota',
      model: 'Camry',
      trim: 'XLE',
      stockNumber: 'AUT-001',
      askingPrice: 35000,
      imageUrls: [],
    },
  ],
  stats: {
    totalWonValue: 0,
    totalVisits: 5,
    testDriveCount: 1,
    activeDeals: 1,
    wonDeals: 0,
    lostDeals: 0,
    engagementScore: 75,
  },
};

describe('CustomerJourneyBoard', () => {
  it('returns null when journey is null', () => {
    const { container } = render(<CustomerJourneyBoard journey={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders stats row with Engagement, Visits, Test Drives, Active Deals', () => {
    render(<CustomerJourneyBoard journey={mockJourney} />);
    expect(screen.getByText('Engagement')).toBeInTheDocument();
    expect(screen.getByText('Visits')).toBeInTheDocument();
    expect(screen.getByText('Test Drives')).toBeInTheDocument();
    expect(screen.getAllByText('Active Deals').length).toBeGreaterThanOrEqual(1);
    // Visits = 5
    expect(screen.getByText('5')).toBeInTheDocument();
    // Test Drives = 1, Active Deals = 1 (both show '1')
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
    // Engagement score = 75
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('renders vehicles of interest chips with make/model/price', () => {
    render(<CustomerJourneyBoard journey={mockJourney} />);
    expect(screen.getByText('Vehicles of Interest')).toBeInTheDocument();
    // Vehicle info appears in both vehicles section and active deals section
    expect(screen.getAllByText(/2025 Toyota Camry/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('#AUT-001').length).toBeGreaterThanOrEqual(1);
  });

  it('renders active deals with stage badge and value', () => {
    render(<CustomerJourneyBoard journey={mockJourney} />);
    expect(screen.getByText('Active Deals', { selector: 'h3' })).toBeInTheDocument();
    // 'Negotiation' may appear in both timeline and deals section
    expect(screen.getAllByText('Negotiation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('$42,000')).toBeInTheDocument();
    expect(screen.getByText('Mike Sales')).toBeInTheDocument();
  });

  it('renders stage timeline for the primary deal', () => {
    render(<CustomerJourneyBoard journey={mockJourney} />);
    expect(screen.getByText('Sales Journey')).toBeInTheDocument();
    // Stage labels appear in timeline
    expect(screen.getAllByText('Inquiry').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Qualified').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "No active deals" section hidden when all deals are closed', () => {
    const closedJourney = {
      ...mockJourney,
      deals: [
        {
          ...mockJourney.deals[0],
          stage: 'CLOSED_WON',
        },
      ],
      stats: {
        ...mockJourney.stats,
        activeDeals: 0,
      },
    };
    render(<CustomerJourneyBoard journey={closedJourney} />);
    // The "Active Deals" section heading should not render when no active deals
    const headings = screen.queryAllByText('Active Deals', { selector: 'h3' });
    expect(headings).toHaveLength(0);
  });
});

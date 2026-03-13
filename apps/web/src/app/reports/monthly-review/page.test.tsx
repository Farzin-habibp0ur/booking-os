const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => null,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

jest.mock('lucide-react', () => ({
  ChevronLeft: () => <span data-testid="chevron-left" />,
  ChevronRight: () => <span data-testid="chevron-right" />,
  Sparkles: () => <span data-testid="sparkles-icon" />,
  TrendingUp: () => <span data-testid="trending-up" />,
  TrendingDown: () => <span data-testid="trending-down" />,
  Printer: () => <span data-testid="printer-icon" />,
  Loader2: (p: any) => <span data-testid="loader-icon" {...p} />,
  Bot: () => <span data-testid="bot-icon" />,
  FileText: () => <span data-testid="file-text-icon" />,
  Zap: () => <span data-testid="zap-icon" />,
  DollarSign: () => <span data-testid="dollar-icon" />,
  Calendar: () => <span data-testid="calendar-icon" />,
}));

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import MonthlyReviewPage from './page';
import { api } from '@/lib/api';

const mockReview = {
  id: 'rev-1',
  month: '2027-01',
  metrics: {
    totalBookings: 120,
    completedBookings: 100,
    noShowCount: 5,
    noShowRate: 5,
    totalRevenue: 15000,
    avgBookingValue: 150,
    revenueChange: 12,
    bookingsChange: 8,
    newCustomers: 25,
    returningCustomers: 40,
    retentionRate: 62,
    topServices: [
      { name: 'Facial', count: 30 },
      { name: 'Botox', count: 25 },
      { name: 'Laser', count: 20 },
    ],
    topStaff: [
      { name: 'Dr. Sarah', completed: 45 },
      { name: 'Dr. Maya', completed: 35 },
    ],
    busiestDays: [
      { day: 'Monday', count: 25 },
      { day: 'Wednesday', count: 22 },
      { day: 'Friday', count: 20 },
    ],
    busiestHours: [
      { hour: 10, count: 15 },
      { hour: 14, count: 12 },
    ],
    aiStats: { actionCardsCreated: 10, actionCardsApproved: 8, actionCardsDismissed: 2 },
    contentStats: { published: 5, pending: 3 },
  },
  aiSummary:
    'This was a strong month for the business.\n\nBookings grew by 8%.\n\nRECOMMENDATIONS_JSON:\n[{"title":"Boost marketing","description":"Run a campaign","link":"/campaigns"},{"title":"Reduce no-shows","description":"Send reminders","link":"/settings"},{"title":"Add services","description":"Expand offerings","link":"/services"}]',
};

const mockMktReview = {
  id: 'mkt-1',
  month: '2027-01',
  generatedAt: '2027-02-01T00:00:00Z',
  status: 'COMPLETED',
  summary: 'Marketing performance was strong this month with 45 pieces of content created.',
  contentPerformance: {
    totalCreated: 45,
    totalPublished: 38,
    approvalRate: 84.4,
    topContent: [
      { title: '5 Tips for Glowing Skin', engagementScore: 92, platform: 'Instagram' },
      { title: 'Behind the Scenes', engagementScore: 78, platform: 'TikTok' },
    ],
    volumeTrend: [
      { week: 'W1', count: 10 },
      { week: 'W2', count: 12 },
      { week: 'W3', count: 11 },
      { week: 'W4', count: 12 },
    ],
  },
  agentEfficiency: {
    agents: [
      { name: 'Blog Writer', runs: 30, successRate: 93, itemsProduced: 45 },
      { name: 'Social Creator', runs: 60, successRate: 88, itemsProduced: 120 },
    ],
    overallSuccessRate: 90,
  },
  budgetUtilization: {
    totalBudget: 500,
    totalSpent: 380,
    burnRate: 76,
    byCategory: [
      { category: 'Content', amount: 200, budget: 250 },
      { category: 'Tools', amount: 180, budget: 250 },
    ],
  },
  recommendations: [
    { title: 'Increase social frequency', description: 'Post 5x/day instead of 3x', priority: 'HIGH' },
    { title: 'Optimize blog SEO', description: 'Add internal links', priority: 'MEDIUM' },
  ],
};

function setupMocks(bizReview = mockReview, mktReview: any = mockMktReview) {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    if (url.startsWith('/business-review/')) return Promise.resolve(bizReview);
    if (url === '/dashboard-briefing/monthly-review') return Promise.resolve(mktReview);
    return Promise.resolve(null);
  });
}

describe('MonthlyReviewPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Business Review Tests ---

  it('renders page title', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });
    expect(screen.getByText('Monthly Review')).toBeInTheDocument();
  });

  it('displays month selector', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });
    expect(screen.getByTestId('month-display')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous month')).toBeInTheDocument();
    expect(screen.getByLabelText('Next month')).toBeInTheDocument();
  });

  it('renders KPI cards with metrics', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('$15,000')).toBeInTheDocument();
      expect(screen.getByText('Bookings')).toBeInTheDocument();
      expect(screen.getByText('120')).toBeInTheDocument();
      expect(screen.getByText('New Customers')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });
  });

  it('renders AI summary section', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('AI Business Review')).toBeInTheDocument();
      expect(screen.getByText('This was a strong month for the business.')).toBeInTheDocument();
    });
  });

  it('renders recommendations', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Boost marketing')).toBeInTheDocument();
      expect(screen.getByText('Reduce no-shows')).toBeInTheDocument();
      expect(screen.getByText('Add services')).toBeInTheDocument();
    });
  });

  it('renders charts', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Revenue Trend')).toBeInTheDocument();
      expect(screen.getByText('Top Services')).toBeInTheDocument();
      expect(screen.getByText('Bookings by Day of Week')).toBeInTheDocument();
    });
  });

  it('navigates months on arrow click', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    const prevButton = screen.getByLabelText('Previous month');

    await act(async () => {
      fireEvent.click(prevButton);
    });

    // Should have called API again with new month
    expect(api.get).toHaveBeenCalledTimes(4); // 2 initial (biz + mkt) + 2 after nav
  });

  it('renders print button', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });
    expect(screen.getByText('Print')).toBeInTheDocument();
  });

  it('shows error state on API failure', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('/business-review/')) return Promise.reject(new Error('fail'));
      if (url === '/dashboard-briefing/monthly-review') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to load review')).toBeInTheDocument();
    });
  });

  it('renders stat cards', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Avg Booking Value')).toBeInTheDocument();
      expect(screen.getByText('Retention Rate')).toBeInTheDocument();
      expect(screen.getByText('Returning Customers')).toBeInTheDocument();
    });
  });

  // --- Generate Report Button Tests ---

  it('renders generate report button', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    expect(screen.getByTestId('generate-report-btn')).toBeInTheDocument();
    expect(screen.getByText('Generate Report')).toBeInTheDocument();
  });

  it('calls generate API on button click', async () => {
    setupMocks();
    (api.post as jest.Mock).mockResolvedValue(mockMktReview);
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('generate-report-btn'));
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/dashboard-briefing/monthly-review/generate', {});
    });
  });

  it('shows toast on generate success', async () => {
    setupMocks();
    (api.post as jest.Mock).mockResolvedValue(mockMktReview);
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('generate-report-btn'));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Marketing review generated', 'success');
    });
  });

  it('shows toast on generate failure', async () => {
    setupMocks();
    (api.post as jest.Mock).mockRejectedValue(new Error('fail'));
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('generate-report-btn'));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to generate review', 'error');
    });
  });

  // --- Marketing Performance Section Tests ---

  it('renders marketing performance header', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Marketing Performance')).toBeInTheDocument();
    });
  });

  it('renders executive summary', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('executive-summary')).toBeInTheDocument();
      expect(screen.getByText(/Marketing performance was strong/)).toBeInTheDocument();
    });
  });

  it('renders content performance section', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('content-performance-section')).toBeInTheDocument();
      expect(screen.getByText('Content Performance')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument(); // totalCreated
      expect(screen.getByText('38')).toBeInTheDocument(); // totalPublished
      expect(screen.getByText('84%')).toBeInTheDocument(); // approvalRate
    });
  });

  it('renders top content table', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('top-content-table')).toBeInTheDocument();
      expect(screen.getByText('5 Tips for Glowing Skin')).toBeInTheDocument();
      expect(screen.getByText('Behind the Scenes')).toBeInTheDocument();
    });
  });

  it('renders agent efficiency section', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('agent-efficiency-section')).toBeInTheDocument();
      expect(screen.getByText('Agent Efficiency')).toBeInTheDocument();
      expect(screen.getByText('Blog Writer')).toBeInTheDocument();
      expect(screen.getByText('Social Creator')).toBeInTheDocument();
      expect(screen.getByText('30 runs')).toBeInTheDocument();
      expect(screen.getByText('60 runs')).toBeInTheDocument();
    });
  });

  it('renders budget utilization section', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('budget-section')).toBeInTheDocument();
      expect(screen.getByText('Budget Utilization')).toBeInTheDocument();
      expect(screen.getByText('$500')).toBeInTheDocument();
      expect(screen.getByText('$380')).toBeInTheDocument();
      expect(screen.getByText('76%')).toBeInTheDocument();
    });
  });

  it('renders marketing recommendations', async () => {
    setupMocks();
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('mkt-recommendations')).toBeInTheDocument();
      expect(screen.getByText('Marketing Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Increase social frequency')).toBeInTheDocument();
      expect(screen.getByText('Optimize blog SEO')).toBeInTheDocument();
    });
  });

  it('shows empty state when no marketing review', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('/business-review/')) return Promise.resolve(mockReview);
      if (url === '/dashboard-briefing/monthly-review') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('mkt-empty-state')).toBeInTheDocument();
      expect(screen.getByText(/No marketing review available/)).toBeInTheDocument();
    });
  });
});

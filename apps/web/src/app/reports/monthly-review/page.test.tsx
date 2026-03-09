jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => null,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
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

describe('MonthlyReviewPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue(mockReview);
  });

  it('renders page title', async () => {
    await act(async () => {
      render(<MonthlyReviewPage />);
    });
    expect(screen.getByText('Monthly Review')).toBeInTheDocument();
  });

  it('displays month selector', async () => {
    await act(async () => {
      render(<MonthlyReviewPage />);
    });
    expect(screen.getByTestId('month-display')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous month')).toBeInTheDocument();
    expect(screen.getByLabelText('Next month')).toBeInTheDocument();
  });

  it('renders KPI cards with metrics', async () => {
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
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('AI Business Review')).toBeInTheDocument();
      expect(screen.getByText('This was a strong month for the business.')).toBeInTheDocument();
    });
  });

  it('renders recommendations', async () => {
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
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    const prevButton = screen.getByLabelText('Previous month');

    await act(async () => {
      fireEvent.click(prevButton);
    });

    // Should have called API again with new month
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('renders print button', async () => {
    await act(async () => {
      render(<MonthlyReviewPage />);
    });
    expect(screen.getByText('Print')).toBeInTheDocument();
  });

  it('shows error state on API failure', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('fail'));

    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to load review')).toBeInTheDocument();
    });
  });

  it('renders stat cards', async () => {
    await act(async () => {
      render(<MonthlyReviewPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Avg Booking Value')).toBeInTheDocument();
      expect(screen.getByText('Retention Rate')).toBeInTheDocument();
      expect(screen.getByText('Returning Customers')).toBeInTheDocument();
    });
  });
});

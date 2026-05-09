const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { get: (...args: any[]) => mockGet(...args) },
}));
jest.mock('lucide-react', () => ({
  Info: () => <span data-testid="icon-info" />,
}));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AIValueKPIs } from './ai-value-kpis';

const mockSummary = {
  days: 30,
  captured: { count: 18, revenue: 7200 },
  wouldHaveBeenMissed: {
    count: 6,
    revenue: 2400,
    byReason: {
      WAITLIST_MATCH: { count: 1, revenue: 400 },
      AI_BOOKING: { count: 2, revenue: 800 },
      QUOTE_FOLLOWUP: { count: 1, revenue: 400 },
      CONSULT_FOLLOWUP: { count: 1, revenue: 400 },
      AFTER_HOURS_AI: { count: 1, revenue: 400 },
      UNANSWERED_THRESHOLD: { count: 0, revenue: 0 },
      ORGANIC: { count: 12, revenue: 4800 },
    },
  },
  responseTimeMedianMinutes: 7.5,
  baseline: {
    monthlyBookings: 30,
    monthlyRevenue: 12000,
    source: 'concierge_call',
    capturedAt: '2026-04-01T00:00:00Z',
  },
};

describe('AIValueKPIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the two-metric layout with captured and would-have-been-missed cards', async () => {
    mockGet.mockResolvedValue(mockSummary);

    render(<AIValueKPIs />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/front-desk/summary?days=30');
      expect(screen.getByText('Bookings captured')).toBeInTheDocument();
      expect(screen.getByText('Of which, would have been missed without BCC')).toBeInTheDocument();
    });
  });

  it('displays counts and revenue from the v3 summary endpoint', async () => {
    mockGet.mockResolvedValue(mockSummary);

    render(<AIValueKPIs />);

    await waitFor(() => {
      expect(screen.getByText('18')).toBeInTheDocument();
      expect(screen.getByText('$7,200 in revenue')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('$2,400 in revenue')).toBeInTheDocument();
    });
  });

  it('shows baseline comparison when business has captured a baseline', async () => {
    mockGet.mockResolvedValue(mockSummary);

    render(<AIValueKPIs />);

    await waitFor(() => {
      expect(
        screen.getByText(/vs baseline of 30 bookings \/ \$12,000 per month/i),
      ).toBeInTheDocument();
    });
  });

  it('hides baseline comparison when no baseline has been captured', async () => {
    mockGet.mockResolvedValue({
      ...mockSummary,
      baseline: {
        monthlyBookings: null,
        monthlyRevenue: null,
        source: 'concierge_call',
        capturedAt: null,
      },
    });

    render(<AIValueKPIs />);

    await waitFor(() => expect(screen.getByText('Bookings captured')).toBeInTheDocument());

    expect(screen.queryByText(/vs baseline/i)).not.toBeInTheDocument();
  });

  it('toggles the methodology tooltip on the Info button', async () => {
    mockGet.mockResolvedValue(mockSummary);

    render(<AIValueKPIs />);

    await waitFor(() =>
      expect(screen.getByText('Of which, would have been missed without BCC')).toBeInTheDocument(),
    );

    expect(screen.queryByTestId('methodology-tooltip')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Methodology'));

    expect(screen.getByTestId('methodology-tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('methodology-tooltip').textContent).toMatch(/Waitlist match/);
  });

  it('shows skeleton placeholders during loading', () => {
    mockGet.mockImplementation(() => new Promise(() => {}));

    render(<AIValueKPIs />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
  });

  it('handles API errors gracefully and renders zeros', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    render(<AIValueKPIs />);

    await waitFor(() => {
      expect(screen.getByText('Bookings captured')).toBeInTheDocument();
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(2);
      const revenueZeros = screen.getAllByText('$0 in revenue');
      expect(revenueZeros.length).toBeGreaterThanOrEqual(2);
    });
  });
});

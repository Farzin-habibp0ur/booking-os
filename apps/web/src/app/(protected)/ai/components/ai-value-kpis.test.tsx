const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { get: (...args: any[]) => mockGet(...args) },
}));
jest.mock('lucide-react', () => ({
  CalendarCheck: () => <span data-testid="icon-calendar-check" />,
  DollarSign: () => <span data-testid="icon-dollar-sign" />,
  FileEdit: () => <span data-testid="icon-file-edit" />,
  MessageSquare: () => <span data-testid="icon-message-square" />,
}));

import { render, screen, waitFor } from '@testing-library/react';
import { AIValueKPIs } from './ai-value-kpis';

const mockSummary = {
  leadsCaptured: 18,
  approvedReplies: 11,
  bookingsAttributed: 4,
  estimatedRecoveredRevenue: 1240,
};

describe('AIValueKPIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Front Desk KPI labels', async () => {
    mockGet.mockResolvedValue(mockSummary);

    render(<AIValueKPIs />);

    await waitFor(() => {
      expect(screen.getByText('Leads Captured')).toBeInTheDocument();
      expect(screen.getByText('Drafts Approved')).toBeInTheDocument();
      expect(screen.getByText('Bookings Attributed')).toBeInTheDocument();
      expect(screen.getByText('Recovered Revenue')).toBeInTheDocument();
    });
  });

  it('shows values from the Front Desk summary endpoint', async () => {
    mockGet.mockResolvedValue(mockSummary);

    render(<AIValueKPIs />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/front-desk/summary?days=30');
      expect(screen.getByText('18')).toBeInTheDocument();
      expect(screen.getByText('11')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('$1,240')).toBeInTheDocument();
    });
  });

  it('shows 4 loading skeleton blocks during loading', () => {
    mockGet.mockImplementation(() => new Promise(() => {}));

    render(<AIValueKPIs />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons).toHaveLength(4);
  });

  it('handles API error gracefully and shows default values', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    render(<AIValueKPIs />);

    await waitFor(() => {
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(3);
      expect(screen.getByText('$0')).toBeInTheDocument();
    });
  });
});

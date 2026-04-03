const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { get: (...args: any[]) => mockGet(...args) },
}));
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));
jest.mock('lucide-react', () => ({
  MessageSquare: () => <span data-testid="icon-message-square" />,
  Zap: () => <span data-testid="icon-zap" />,
  Bot: () => <span data-testid="icon-bot" />,
  FileEdit: () => <span data-testid="icon-file-edit" />,
}));

import { render, screen, waitFor } from '@testing-library/react';
import { AIValueKPIs } from './ai-value-kpis';

const mockStats = {
  processedToday: 15,
  autoReplied: 8,
  draftsCreated: 4,
  failed: 1,
  dailyLimit: 500,
  history: [],
};
const mockAgentStats = { totalRuns: 23, byAgent: [], byStatus: [] };

describe('AIValueKPIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders 4 KPI cards with correct labels', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/ai/stats') return Promise.resolve(mockStats);
      if (url === '/agent-runs/stats') return Promise.resolve(mockAgentStats);
      return Promise.resolve({});
    });

    render(<AIValueKPIs />);

    await waitFor(() => {
      expect(screen.getByText('Conversations Handled')).toBeInTheDocument();
      expect(screen.getByText('Auto-Replies Sent')).toBeInTheDocument();
      expect(screen.getByText('Agent Tasks')).toBeInTheDocument();
      expect(screen.getByText('Drafts Pending')).toBeInTheDocument();
    });
  });

  it('shows correct values from mocked API data', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/ai/stats') return Promise.resolve(mockStats);
      if (url === '/agent-runs/stats') return Promise.resolve(mockAgentStats);
      return Promise.resolve({});
    });

    render(<AIValueKPIs />);

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('23')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  it('shows 4 loading skeleton blocks during loading', () => {
    // Never resolve to keep loading state
    mockGet.mockImplementation(() => new Promise(() => {}));

    render(<AIValueKPIs />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons).toHaveLength(4);
  });

  it('handles API error gracefully and shows 0 values', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    render(<AIValueKPIs />);

    await waitFor(() => {
      // All values should default to 0
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(4);
    });
  });
});

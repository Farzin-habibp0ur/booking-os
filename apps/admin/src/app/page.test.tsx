import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import Page from './page';

beforeEach(() => resetMocks());

describe('Overview Dashboard', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<Page />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockResolvedValue({
      businesses: {
        total: 12,
        withActiveSubscription: 8,
        trial: 2,
        pastDue: 1,
        canceled: 1,
      },
      bookings: { total: 345, today: 5, last7d: 30, last30d: 120 },
      platform: {
        totalStaff: 28,
        totalCustomers: 150,
        totalConversations: 80,
        totalAgentRuns: 200,
        agentRuns7d: 50,
        failedAgentRuns7d: 2,
      },
      support: { openCases: 3 },
      security: { activeViewAsSessions: 0 },
      recentAuditLogs: [],
      attentionItems: [],
      accountsAtRisk: [],
    });

    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText('Platform Overview')).toBeInTheDocument();
    });
  });
});

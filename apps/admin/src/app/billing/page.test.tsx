import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import Page from './page';

beforeEach(() => resetMocks());

describe('Billing Dashboard', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<Page />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockResolvedValue({
      mrr: 0,
      activeCount: 0,
      trialCount: 0,
      pastDueCount: 0,
      canceledCount: 0,
      churnRate: 0,
      arpa: 0,
      trialToPaidRate: 0,
      planDistribution: { basic: 0, pro: 0 },
      totalRevenue30d: 0,
    });

    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText('Billing')).toBeInTheDocument();
    });
  });
});

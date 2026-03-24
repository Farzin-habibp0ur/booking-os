jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import RejectionAnalyticsPage from './page';

beforeEach(() => resetMocks());

describe('RejectionAnalyticsPage', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<RejectionAnalyticsPage />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/stats')) {
        return Promise.resolve({
          byGate: [],
          byCode: [],
          byAgent: [],
          bySeverity: [],
        });
      }
      if (url.includes('/weekly-summary')) {
        return Promise.resolve({
          totalThisWeek: 3,
          totalLastWeek: 5,
          changePercent: -40,
          mostCommonCode: 'R01',
          mostRejectedAgent: 'MKT_BLOG_WRITER',
          rejectionRate: 15,
          byCode: [],
          byAgent: [],
        });
      }
      return Promise.resolve({ items: [], total: 0 });
    });

    render(<RejectionAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Rejection Analytics')).toBeInTheDocument();
    });
  });
});

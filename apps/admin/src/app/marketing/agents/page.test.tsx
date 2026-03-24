jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import AgentsPage from './page';

beforeEach(() => resetMocks());

describe('AgentsPage', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<AgentsPage />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/admin/all')) {
        return Promise.resolve([
          {
            id: 'a1',
            agentType: 'MKT_BLOG_WRITER',
            isEnabled: true,
            config: {},
            runIntervalMinutes: 60,
            lastRunAt: '2026-03-20T00:00:00Z',
          },
        ]);
      }
      if (url.includes('/agent-runs')) {
        return Promise.resolve([]);
      }
      if (url.includes('/performance')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    render(<AgentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Marketing Agents')).toBeInTheDocument();
    });
  });
});

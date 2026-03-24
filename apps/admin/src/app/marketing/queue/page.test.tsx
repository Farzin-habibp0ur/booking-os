jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import QueuePage from './page';

beforeEach(() => resetMocks());

describe('QueuePage', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<QueuePage />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/stats')) {
        return Promise.resolve({
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          published: 0,
        });
      }
      if (url.includes('/pillar-balance')) {
        return Promise.resolve([]);
      }
      return Promise.resolve({ items: [], total: 0 });
    });

    render(<QueuePage />);

    await waitFor(() => {
      expect(screen.getByText('Content Queue')).toBeInTheDocument();
    });
  });
});

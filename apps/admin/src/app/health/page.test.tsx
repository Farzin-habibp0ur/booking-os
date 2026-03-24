import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import Page from './page';

beforeEach(() => resetMocks());

describe('System Health', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<Page />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockResolvedValue({
      status: 'healthy',
      checks: [],
      businessHealth: { green: 0, yellow: 0, red: 0, total: 0 },
      checkedAt: new Date().toISOString(),
    });

    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/System Health/i)).toBeInTheDocument();
    });
  });
});

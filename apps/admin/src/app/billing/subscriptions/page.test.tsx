import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import Page from './page';

beforeEach(() => resetMocks());

describe('Subscriptions', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<Page />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    render(<Page />);

    await waitFor(() => {
      expect(screen.getAllByText(/Subscriptions/).length).toBeGreaterThan(0);
    });
  });
});

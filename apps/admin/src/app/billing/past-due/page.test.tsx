import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import Page from './page';

beforeEach(() => resetMocks());

describe('Past-Due Accounts', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<Page />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    // Past-due page expects an array directly, not paginated response
    mockApi.get.mockResolvedValue([]);

    render(<Page />);

    await waitFor(() => {
      expect(screen.getAllByText(/past-due/i).length).toBeGreaterThan(0);
    });
  });
});

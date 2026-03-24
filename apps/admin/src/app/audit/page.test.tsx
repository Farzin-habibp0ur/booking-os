import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import Page from './page';

beforeEach(() => resetMocks());

describe('Audit Log', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<Page />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/admin/audit/action-types')) {
        return Promise.resolve(['VIEW_AS_START', 'VIEW_AS_END']);
      }
      return Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });
    });

    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/Audit/i)).toBeInTheDocument();
    });
  });
});

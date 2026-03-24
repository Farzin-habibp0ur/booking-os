import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import Page from './page';

beforeEach(() => resetMocks());

describe('Business Directory', () => {
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
      expect(screen.getByText('Businesses')).toBeInTheDocument();
    });
  });

  it('displays businesses when data is returned', async () => {
    mockApi.get.mockResolvedValue({
      items: [
        {
          id: 'biz1',
          name: 'Glow Clinic',
          slug: 'glow',
          plan: 'professional',
          billingStatus: 'active',
          health: 'green',
          lastActive: new Date().toISOString(),
          staffCount: 3,
          customerCount: 50,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText('Glow Clinic')).toBeInTheDocument();
    });
  });
});

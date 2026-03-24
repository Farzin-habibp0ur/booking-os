import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import SupportPage from './page';

beforeEach(() => resetMocks());

describe('SupportPage', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<SupportPage />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockResolvedValue({
      items: [
        {
          id: 's1',
          businessId: 'b1',
          businessName: 'Glow Clinic',
          subject: 'Login issue',
          description: 'Cannot log in',
          status: 'OPEN',
          priority: 'HIGH',
          category: 'auth',
          resolution: null,
          resolvedAt: null,
          closedAt: null,
          createdById: 'u1',
          createdAt: '2026-03-20T00:00:00Z',
          updatedAt: '2026-03-20T00:00:00Z',
          _count: { notes: 2 },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    render(<SupportPage />);

    await waitFor(() => {
      expect(screen.getByText('Support Cases')).toBeInTheDocument();
    });
  });
});

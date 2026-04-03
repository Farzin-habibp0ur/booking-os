import { render, screen, waitFor } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/businesses/biz1',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'biz1' }),
}));

import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import Page from './page';

beforeEach(() => resetMocks());

describe('Business 360', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<Page />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    // Business 360 makes 2 parallel calls: business detail + usage
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/usage')) {
        return Promise.resolve({
          bookings7d: 5,
          bookings30d: 20,
          conversations: 10,
          waitlistEntries: 3,
          campaigns: 1,
        });
      }
      // Business detail
      return Promise.resolve({
        id: 'biz1',
        name: 'Test Business',
        slug: 'test',
        timezone: 'America/New_York',
        verticalPack: 'aesthetic',
        packConfig: {},
        defaultLocale: 'en',
        createdAt: '2025-01-01T00:00:00Z',
        owner: { name: 'John Doe', email: 'john@test.com' },
        subscription: {
          plan: 'starter',
          status: 'active',
          currentPeriodEnd: '2025-12-01T00:00:00Z',
        },
        health: 'green',
        lastActive: '2025-06-01T00:00:00Z',
        counts: {
          bookings: 10,
          customers: 5,
          conversations: 3,
          staff: 2,
          services: 4,
          campaigns: 0,
          waitlistEntries: 1,
        },
      });
    });

    render(<Page />);

    await waitFor(() => {
      expect(screen.getAllByText('Test Business').length).toBeGreaterThan(0);
    });
  });
});

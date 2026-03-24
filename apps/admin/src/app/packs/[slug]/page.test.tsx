jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/packs/aesthetic',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ slug: 'aesthetic' }),
}));

import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import PackDetailPage from './page';

beforeEach(() => resetMocks());

describe('PackDetailPage', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<PackDetailPage />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/detail')) {
        return Promise.resolve({
          slug: 'aesthetic',
          name: 'Aesthetic',
          description: 'Aesthetic clinic pack',
          versions: [
            {
              id: 'v1',
              version: 1,
              isPublished: true,
              rolloutStage: 'published',
              rolloutPercent: 100,
              rolloutStartedAt: '2026-03-01T00:00:00Z',
              rolloutCompletedAt: '2026-03-02T00:00:00Z',
              rolloutPausedAt: null,
              rolledBackAt: null,
              rolledBackReason: null,
              config: {},
              createdAt: '2026-03-01T00:00:00Z',
              updatedAt: '2026-03-02T00:00:00Z',
            },
          ],
          businessCount: 5,
          totalBusinesses: 10,
          adoptionPercent: 50,
          pinnedCount: 1,
        });
      }
      if (url.includes('/pins')) {
        return Promise.resolve([]);
      }
      return Promise.resolve({});
    });

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Aesthetic').length).toBeGreaterThan(0);
    });
  });
});

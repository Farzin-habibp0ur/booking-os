import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import PacksPage from './page';

beforeEach(() => resetMocks());

describe('PacksPage', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<PacksPage />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockResolvedValue([
      {
        slug: 'aesthetic',
        name: 'Aesthetic',
        description: 'Aesthetic clinic pack',
        latestVersion: 1,
        rolloutStage: 'published',
        rolloutPercent: 100,
        isPublished: true,
        businessCount: 5,
        totalBusinesses: 10,
        adoptionPercent: 50,
        skillCount: 3,
        versionCount: 1,
      },
    ]);

    render(<PacksPage />);

    await waitFor(() => {
      expect(screen.getByText('Pack Registry')).toBeInTheDocument();
    });
  });
});

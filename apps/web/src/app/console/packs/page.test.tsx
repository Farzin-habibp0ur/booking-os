import { render, screen, waitFor } from '@testing-library/react';
import ConsolePacksPage from './page';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), del: jest.fn() },
}));

jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useParams: () => ({ slug: 'aesthetic' }),
}));

const mockPacks = [
  {
    slug: 'aesthetic',
    name: 'Aesthetic',
    description: 'For clinics',
    latestVersion: 2,
    rolloutStage: 'rolling_out',
    rolloutPercent: 25,
    isPublished: true,
    businessCount: 6,
    totalBusinesses: 10,
    adoptionPercent: 60,
    skillCount: 5,
    versionCount: 2,
  },
  {
    slug: 'dealership',
    name: 'Dealership',
    description: 'For auto dealerships',
    latestVersion: 1,
    rolloutStage: 'completed',
    rolloutPercent: 100,
    isPublished: true,
    businessCount: 3,
    totalBusinesses: 10,
    adoptionPercent: 30,
    skillCount: 5,
    versionCount: 1,
  },
  {
    slug: 'general',
    name: 'General',
    description: null,
    latestVersion: 1,
    rolloutStage: 'published',
    rolloutPercent: 0,
    isPublished: true,
    businessCount: 1,
    totalBusinesses: 10,
    adoptionPercent: 10,
    skillCount: 5,
    versionCount: 1,
  },
];

describe('ConsolePacksPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state', () => {
    (api.get as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<ConsolePacksPage />);
    expect(screen.getByTestId('packs-loading')).toBeInTheDocument();
  });

  it('renders pack cards after loading', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockPacks);

    render(<ConsolePacksPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pack-grid')).toBeInTheDocument();
    });

    expect(screen.getByTestId('pack-card-aesthetic')).toBeInTheDocument();
    expect(screen.getByTestId('pack-card-dealership')).toBeInTheDocument();
    expect(screen.getByTestId('pack-card-general')).toBeInTheDocument();
  });

  it('displays adoption stats correctly', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockPacks);

    render(<ConsolePacksPage />);

    await waitFor(() => {
      expect(screen.getByTestId('adoption-aesthetic')).toHaveTextContent('60%');
    });
    expect(screen.getByTestId('business-count-aesthetic')).toHaveTextContent('6 businesses');
    expect(screen.getByTestId('adoption-dealership')).toHaveTextContent('30%');
  });

  it('shows rollout status badges', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockPacks);

    render(<ConsolePacksPage />);

    await waitFor(() => {
      expect(screen.getByTestId('rollout-badge-aesthetic')).toHaveTextContent('Rolling Out 25%');
    });
    expect(screen.getByTestId('rollout-badge-dealership')).toHaveTextContent('Completed');
    expect(screen.getByTestId('rollout-badge-general')).toHaveTextContent('Published');
  });

  it('links pack cards to detail pages', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockPacks);

    render(<ConsolePacksPage />);

    await waitFor(() => {
      const card = screen.getByTestId('pack-card-aesthetic');
      expect(card).toHaveAttribute('href', '/console/packs/aesthetic');
    });
  });

  it('renders sub-navigation tabs', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockPacks);

    render(<ConsolePacksPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-registry')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tab-skills')).toBeInTheDocument();
    expect(screen.getByTestId('tab-skills')).toHaveAttribute('href', '/console/packs/skills');
  });

  it('shows error state', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<ConsolePacksPage />);

    await waitFor(() => {
      expect(screen.getByTestId('packs-error')).toHaveTextContent('Network error');
    });
  });

  it('shows empty state when no packs', async () => {
    (api.get as jest.Mock).mockResolvedValue([]);

    render(<ConsolePacksPage />);

    await waitFor(() => {
      expect(screen.getByTestId('packs-empty')).toBeInTheDocument();
    });
  });

  it('displays version count and skill count', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockPacks);

    render(<ConsolePacksPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pack-card-aesthetic')).toHaveTextContent('5 skills');
      expect(screen.getByTestId('pack-card-aesthetic')).toHaveTextContent('2 ver.');
    });
  });

  it('calls GET /admin/packs-console/registry on mount', async () => {
    (api.get as jest.Mock).mockResolvedValue([]);

    render(<ConsolePacksPage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/admin/packs-console/registry');
    });
  });
});

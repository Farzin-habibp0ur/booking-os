import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PackDetailPage from './page';
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

const mockDetail = {
  slug: 'aesthetic',
  name: 'Aesthetic',
  description: 'For clinics',
  versions: [
    {
      id: 'v2',
      version: 2,
      isPublished: true,
      rolloutStage: 'rolling_out',
      rolloutPercent: 25,
      rolloutStartedAt: '2026-02-20T10:00:00Z',
      rolloutCompletedAt: null,
      rolloutPausedAt: null,
      rolledBackAt: null,
      rolledBackReason: null,
      config: { labels: { customer: 'Patient' } },
      createdAt: '2026-02-18T10:00:00Z',
      updatedAt: '2026-02-20T10:00:00Z',
    },
    {
      id: 'v1',
      version: 1,
      isPublished: true,
      rolloutStage: 'completed',
      rolloutPercent: 100,
      rolloutStartedAt: '2026-01-15T10:00:00Z',
      rolloutCompletedAt: '2026-01-20T10:00:00Z',
      rolloutPausedAt: null,
      rolledBackAt: null,
      rolledBackReason: null,
      config: {},
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: '2026-01-20T10:00:00Z',
    },
  ],
  businessCount: 6,
  totalBusinesses: 10,
  adoptionPercent: 60,
  pinnedCount: 1,
};

const mockPins = [
  {
    id: 'pin1',
    businessId: 'biz1',
    businessName: 'Glow Clinic',
    businessSlug: 'glow-clinic',
    packSlug: 'aesthetic',
    pinnedVersion: 1,
    reason: 'Legacy config dependency',
    pinnedBy: { id: 'admin1', name: 'Admin', email: 'admin@test.com' },
    createdAt: '2026-02-18T10:00:00Z',
  },
];

describe('PackDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state', () => {
    (api.get as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<PackDetailPage />);
    expect(screen.getByTestId('pack-detail-loading')).toBeInTheDocument();
  });

  it('renders version history table', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(mockDetail).mockResolvedValueOnce(mockPins);

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('version-table')).toBeInTheDocument();
    });
    expect(screen.getByTestId('version-row-2')).toBeInTheDocument();
    expect(screen.getByTestId('version-row-1')).toBeInTheDocument();
  });

  it('shows rollout progress bar for active rollout', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(mockDetail).mockResolvedValueOnce(mockPins);

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('rollout-panel')).toBeInTheDocument();
    });
    expect(screen.getByTestId('rollout-progress')).toBeInTheDocument();
  });

  it('shows advance and pause buttons for rolling_out version', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(mockDetail).mockResolvedValueOnce(mockPins);

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('advance-rollout')).toHaveTextContent('Advance to 50%');
    });
    expect(screen.getByTestId('pause-rollout')).toBeInTheDocument();
    expect(screen.getByTestId('rollback-btn')).toBeInTheDocument();
  });

  it('shows resume button for paused version', async () => {
    const pausedDetail = {
      ...mockDetail,
      versions: [
        { ...mockDetail.versions[0], rolloutStage: 'paused', rolloutPercent: 25 },
        mockDetail.versions[1],
      ],
    };
    (api.get as jest.Mock).mockResolvedValueOnce(pausedDetail).mockResolvedValueOnce(mockPins);

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('resume-rollout')).toBeInTheDocument();
    });
  });

  it('opens rollback modal when clicking rollback', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(mockDetail).mockResolvedValueOnce(mockPins);

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('rollback-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('rollback-btn'));
    expect(screen.getByTestId('rollback-modal')).toBeInTheDocument();
    expect(screen.getByTestId('rollback-reason')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-rollback')).toBeDisabled();
  });

  it('renders pinned tenants table', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(mockDetail).mockResolvedValueOnce(mockPins);

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pinned-tenants')).toBeInTheDocument();
    });
    expect(screen.getByText('Glow Clinic')).toBeInTheDocument();
    expect(screen.getByText('Legacy config dependency')).toBeInTheDocument();
    expect(screen.getByTestId('unpin-biz1')).toBeInTheDocument();
  });

  it('opens pin modal when clicking Pin Business', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(mockDetail).mockResolvedValueOnce(mockPins);

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pin-business-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pin-business-btn'));
    expect(screen.getByTestId('pin-modal')).toBeInTheDocument();
    expect(screen.getByTestId('pin-business-id')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(mockDetail).mockResolvedValueOnce(mockPins);

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    });
    expect(screen.getByText('Packs & Skills')).toHaveAttribute('href', '/console/packs');
    const breadcrumb = screen.getByTestId('breadcrumb');
    expect(breadcrumb).toHaveTextContent('Aesthetic');
  });

  it('shows error state', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('Not found'));

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pack-detail-error')).toHaveTextContent('Not found');
    });
  });

  it('shows no pins message when pinned list is empty', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(mockDetail).mockResolvedValueOnce([]);

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('no-pins')).toBeInTheDocument();
    });
  });

  it('toggles config viewer', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(mockDetail).mockResolvedValueOnce(mockPins);

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('toggle-config')).toBeInTheDocument();
    });

    expect(screen.queryByText('"Patient"')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('toggle-config'));
    expect(screen.getByText(/"Patient"/)).toBeInTheDocument();
  });
});

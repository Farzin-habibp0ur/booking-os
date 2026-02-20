import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SkillsCatalogPage from './page';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
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
}));

const mockCatalog = {
  packs: [
    {
      slug: 'aesthetic',
      skills: [
        {
          agentType: 'WAITLIST',
          name: 'Waitlist Matching',
          description: 'Matches patients with slots',
          category: 'proactive',
          defaultEnabled: true,
          enabledCount: 4,
          businessCount: 5,
          adoptionPercent: 80,
        },
        {
          agentType: 'RETENTION',
          name: 'Patient Retention',
          description: 'Detects overdue patients',
          category: 'proactive',
          defaultEnabled: true,
          enabledCount: 3,
          businessCount: 5,
          adoptionPercent: 60,
        },
        {
          agentType: 'DATA_HYGIENE',
          name: 'Duplicate Detection',
          description: 'Identifies duplicates',
          category: 'maintenance',
          defaultEnabled: false,
          enabledCount: 1,
          businessCount: 5,
          adoptionPercent: 20,
        },
      ],
    },
    {
      slug: 'general',
      skills: [
        {
          agentType: 'WAITLIST',
          name: 'Waitlist Matching',
          description: 'General waitlist',
          category: 'proactive',
          defaultEnabled: true,
          enabledCount: 1,
          businessCount: 2,
          adoptionPercent: 50,
        },
      ],
    },
  ],
};

describe('SkillsCatalogPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state', () => {
    (api.get as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<SkillsCatalogPage />);
    expect(screen.getByTestId('skills-loading')).toBeInTheDocument();
  });

  it('renders pack sections after loading', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockCatalog);

    render(<SkillsCatalogPage />);

    await waitFor(() => {
      expect(screen.getByTestId('skills-catalog')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pack-section-aesthetic')).toBeInTheDocument();
    expect(screen.getByTestId('pack-section-general')).toBeInTheDocument();
  });

  it('renders skill tables with correct data', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockCatalog);

    render(<SkillsCatalogPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-row-WAITLIST')).toHaveLength(2); // one per pack
    });
    expect(screen.getByTestId('skill-row-RETENTION')).toBeInTheDocument();
    expect(screen.getByTestId('skill-row-DATA_HYGIENE')).toBeInTheDocument();
  });

  it('shows category badges with correct labels', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockCatalog);

    render(<SkillsCatalogPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('category-badge-WAITLIST')[0]).toHaveTextContent('proactive');
    });
    expect(screen.getByTestId('category-badge-DATA_HYGIENE')).toHaveTextContent('maintenance');
  });

  it('shows adoption percentages', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockCatalog);

    render(<SkillsCatalogPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('adoption-pct-WAITLIST')[0]).toHaveTextContent('80%');
    });
    expect(screen.getByTestId('adoption-pct-RETENTION')).toHaveTextContent('60%');
    expect(screen.getAllByTestId('enabled-count-WAITLIST')[0]).toHaveTextContent('4 / 5');
  });

  it('opens enable all modal when clicking Enable All', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockCatalog);

    render(<SkillsCatalogPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('enable-all-WAITLIST')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('enable-all-WAITLIST')[0]);
    expect(screen.getByTestId('override-modal')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-override')).toHaveTextContent('Enable All');
  });

  it('opens disable all modal when clicking Disable All', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockCatalog);

    render(<SkillsCatalogPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('disable-all-WAITLIST')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('disable-all-WAITLIST')[0]);
    expect(screen.getByTestId('override-modal')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-override')).toHaveTextContent('Disable All');
  });

  it('expands skill detail row when clicking a skill', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(mockCatalog).mockResolvedValueOnce({
      agentType: 'RETENTION',
      name: 'Patient Retention',
      category: 'proactive',
      totalBusinesses: 5,
      enabledCount: 3,
      configs: [
        {
          businessId: 'biz1',
          businessName: 'Glow Clinic',
          businessSlug: 'glow-clinic',
          verticalPack: 'aesthetic',
          isEnabled: true,
          autonomyLevel: 'SUGGEST',
          createdAt: '2026-02-20T10:00:00Z',
        },
      ],
    });

    render(<SkillsCatalogPage />);

    await waitFor(() => {
      expect(screen.getByTestId('skill-row-RETENTION')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('skill-row-RETENTION'));

    await waitFor(() => {
      expect(screen.getByTestId('skill-detail-RETENTION')).toBeInTheDocument();
    });
    expect(screen.getByText('Glow Clinic')).toBeInTheDocument();
    const detailRow = screen.getByTestId('skill-detail-RETENTION');
    expect(detailRow).toHaveTextContent('Enabled');
  });

  it('shows error state', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('Server error'));

    render(<SkillsCatalogPage />);

    await waitFor(() => {
      expect(screen.getByTestId('skills-error')).toHaveTextContent('Server error');
    });
  });

  it('shows empty state when no skills', async () => {
    (api.get as jest.Mock).mockResolvedValue({ packs: [] });

    render(<SkillsCatalogPage />);

    await waitFor(() => {
      expect(screen.getByTestId('skills-empty')).toBeInTheDocument();
    });
  });

  it('calls GET /admin/skills/catalog on mount', async () => {
    (api.get as jest.Mock).mockResolvedValue({ packs: [] });

    render(<SkillsCatalogPage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/admin/skills/catalog');
    });
  });

  it('collapses pack section when clicking header', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockCatalog);

    render(<SkillsCatalogPage />);

    await waitFor(() => {
      expect(screen.getByTestId('skill-row-RETENTION')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-pack-aesthetic'));

    // RETENTION only exists in aesthetic pack, so it should be gone
    expect(screen.queryByTestId('skill-row-RETENTION')).not.toBeInTheDocument();
  });
});

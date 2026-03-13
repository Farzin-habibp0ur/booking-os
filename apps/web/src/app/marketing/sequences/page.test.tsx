import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const mockGet = jest.fn();
const mockPatch = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}));

jest.mock('lucide-react', () => ({
  Mail: (props: any) => <div data-testid="mail-icon" {...props} />,
  ChevronDown: (props: any) => <div data-testid="chevron-down" {...props} />,
  ChevronUp: (props: any) => <div data-testid="chevron-up" {...props} />,
  Users: (props: any) => <div data-testid="users-icon" {...props} />,
  CheckCircle2: (props: any) => <div data-testid="check-circle" {...props} />,
  Pause: (props: any) => <div data-testid="pause-icon" {...props} />,
  Play: (props: any) => <div data-testid="play-icon" {...props} />,
  XCircle: (props: any) => <div data-testid="x-circle" {...props} />,
  AlertTriangle: (props: any) => <div data-testid="alert-triangle" {...props} />,
  TrendingDown: (props: any) => <div data-testid="trending-down" {...props} />,
  BarChart3: (props: any) => <div data-testid="bar-chart" {...props} />,
}));

import EmailSequencesPage from './page';

const mockSequences = [
  {
    id: 'seq1',
    name: 'Welcome Series',
    type: 'WELCOME',
    isActive: true,
    steps: [
      { step: 1, delayHours: 0, subject: 'Welcome!', headline: 'Welcome', body: 'Hello' },
      { step: 2, delayHours: 24, subject: 'Day 2', headline: 'Next', body: 'Next step' },
      { step: 3, delayHours: 72, subject: 'Day 3', headline: 'Tips', body: 'More tips' },
    ],
    triggerEvent: 'SIGNUP',
    _count: { enrollments: 5 },
  },
  {
    id: 'seq2',
    name: 'Trial Expiry',
    type: 'TRIAL_EXPIRY',
    isActive: false,
    steps: [
      { step: 1, delayHours: 0, subject: 'Trial ending', headline: 'Heads up', body: 'Soon' },
    ],
    triggerEvent: 'TRIAL_ENDING',
    _count: { enrollments: 2 },
  },
];

const mockStats = {
  byType: { WELCOME: 1, TRIAL_EXPIRY: 1 },
  byStatus: { ACTIVE: 3, COMPLETED: 2 },
  totalEnrolled: 7,
};

const mockMetrics = {
  steps: [
    { step: 1, sent: 100, opened: 65, clicked: 12, openRate: 65, clickRate: 12, dropOff: 0 },
    { step: 2, sent: 80, opened: 40, clicked: 8, openRate: 50, clickRate: 10, dropOff: 20 },
    { step: 3, sent: 50, opened: 20, clicked: 3, openRate: 40, clickRate: 6, dropOff: 37.5 },
  ],
  totalSent: 230,
  totalOpened: 125,
  totalClicked: 23,
  overallOpenRate: 54.3,
  overallClickRate: 10,
  completionRate: 72,
};

const mockBottleneck = {
  bottleneckStep: 3,
  dropOffRate: 37.5,
  subject: 'Day 3',
  suggestion: 'Consider making the CTA more prominent and reducing email length.',
};

describe('EmailSequencesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/email-sequences/') && url.includes('/metrics'))
        return Promise.resolve(mockMetrics);
      if (url.includes('/email-sequences/') && url.includes('/bottleneck'))
        return Promise.resolve(mockBottleneck);
      if (url.includes('/email-sequences/stats')) return Promise.resolve(mockStats);
      if (url.includes('/email-sequences')) return Promise.resolve(mockSequences);
      return Promise.resolve([]);
    });
    mockPatch.mockResolvedValue({});
  });

  it('renders the page with title', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getByText('Email Sequences')).toBeInTheDocument();
    });
  });

  it('renders stats strip with enrollment data', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('stats-strip')).toBeInTheDocument();
      expect(screen.getByTestId('total-enrolled').textContent).toBe('7');
    });
  });

  it('shows avg conversion stat', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('avg-conversion')).toBeInTheDocument();
    });
  });

  it('renders sequence cards', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('sequence-list')).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId('sequence-card');
    expect(cards).toHaveLength(2);
  });

  it('shows type badges', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('type-badge').length).toBe(2);
    });

    expect(screen.getAllByText('Welcome').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Trial Expiry').length).toBeGreaterThan(0);
  });

  it('shows enrollment count', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getByText('5 enrolled')).toBeInTheDocument();
    });
  });

  it('renders toggle buttons', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('toggle-btn')).toHaveLength(2);
    });
  });

  it('calls toggle endpoint when toggle clicked', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('toggle-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('toggle-btn')[0]);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/email-sequences/seq1', { isActive: false });
    });
  });

  it('expands to show steps timeline with metrics', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('expand-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('expand-btn')[0]);

    // Wait for metrics to load and steps to render
    await waitFor(() => {
      expect(screen.getByText('Welcome!')).toBeInTheDocument();
    });

    expect(screen.getByText('Day 2')).toBeInTheDocument();
    expect(screen.getByTestId('steps-timeline')).toBeInTheDocument();
  });

  it('loads and shows per-step metrics on expand', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('expand-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('expand-btn')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('metrics-summary')).toBeInTheDocument();
    });

    // Check per-step metrics are rendered
    const stepMetrics = screen.getAllByTestId('step-metrics');
    expect(stepMetrics.length).toBeGreaterThan(0);
  });

  it('highlights bottleneck step', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('expand-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('expand-btn')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('bottleneck-step')).toBeInTheDocument();
    });
  });

  it('shows bottleneck suggestion', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('expand-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('expand-btn')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('bottleneck-suggestion')).toBeInTheDocument();
      expect(
        screen.getByText(/Consider making the CTA more prominent/),
      ).toBeInTheDocument();
    });
  });

  it('shows empty state when no sequences', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/email-sequences/stats'))
        return Promise.resolve({ byType: {}, byStatus: {}, totalEnrolled: 0 });
      return Promise.resolve([]);
    });

    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No email sequences')).toBeInTheDocument();
    });
  });

  it('shows step count per sequence', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getByText('3 steps')).toBeInTheDocument();
      expect(screen.getByText('1 steps')).toBeInTheDocument();
    });
  });

  it('shows trigger event info', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getByText('Trigger: signup')).toBeInTheDocument();
    });
  });

  it('fetches metrics and bottleneck endpoints on expand', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('expand-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('expand-btn')[0]);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/email-sequences/seq1/metrics');
      expect(mockGet).toHaveBeenCalledWith('/email-sequences/seq1/bottleneck');
    });
  });
});

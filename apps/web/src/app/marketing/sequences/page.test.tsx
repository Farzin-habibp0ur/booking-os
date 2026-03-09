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

describe('EmailSequencesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/email-sequences/stats')) return Promise.resolve(mockStats);
      return Promise.resolve(mockSequences);
    });
    mockPatch.mockResolvedValue({});
  });

  it('renders the page with title', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getByText('Email Sequences')).toBeInTheDocument();
    });
  });

  it('renders stats strip', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('stats-strip')).toBeInTheDocument();
      expect(screen.getByTestId('total-enrolled').textContent).toBe('7');
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

  it('expands to show steps timeline', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('expand-btn')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTestId('expand-btn')[0]);

    expect(screen.getByTestId('steps-timeline')).toBeInTheDocument();
    expect(screen.getByText('Welcome!')).toBeInTheDocument();
    expect(screen.getByText('Day 2')).toBeInTheDocument();
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
      expect(screen.getByText('2 steps')).toBeInTheDocument();
      expect(screen.getByText('1 steps')).toBeInTheDocument();
    });
  });

  it('shows trigger event info', async () => {
    render(<EmailSequencesPage />);

    await waitFor(() => {
      expect(screen.getByText('Trigger: signup')).toBeInTheDocument();
    });
  });
});

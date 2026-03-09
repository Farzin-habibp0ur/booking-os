import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NpsSurvey } from './nps-survey';

// Mock posthog
const mockTrackEvent = jest.fn();
jest.mock('@/lib/posthog', () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
}));

// Mock api
const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: (...args: any[]) => mockPost(...args),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));

// Mock auth - will be overridden per test
const mockUser: any = {
  id: 'staff1',
  name: 'Sarah',
  role: 'ADMIN',
  businessId: 'biz1',
  business: {
    id: 'biz1',
    name: 'Glow Clinic',
    slug: 'glow',
    verticalPack: 'AESTHETIC',
    defaultLocale: 'en',
    packConfig: {},
    createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(), // 31 days ago
  },
};

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

// Mock localStorage
let localStore: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => localStore[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    localStore[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete localStore[key];
  }),
  clear: jest.fn(() => {
    localStore = {};
  }),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('NpsSurvey', () => {
  beforeEach(() => {
    mockTrackEvent.mockClear();
    mockPost.mockClear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStore = {};
    mockUser.business = {
      id: 'biz1',
      name: 'Glow Clinic',
      slug: 'glow',
      verticalPack: 'AESTHETIC',
      defaultLocale: 'en',
      packConfig: {},
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });

  it('renders when business is 30+ days old', () => {
    render(<NpsSurvey />);

    expect(screen.getByTestId('nps-survey')).toBeInTheDocument();
    expect(
      screen.getByText('How likely are you to recommend Booking OS to a colleague?'),
    ).toBeInTheDocument();
  });

  it('does not render when business is less than 30 days old', () => {
    mockUser.business.createdAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    render(<NpsSurvey />);

    expect(screen.queryByTestId('nps-survey')).not.toBeInTheDocument();
  });

  it('does not render when NPS already submitted (localStorage)', () => {
    localStore['nps-survey-completed'] = 'submitted';

    render(<NpsSurvey />);

    expect(screen.queryByTestId('nps-survey')).not.toBeInTheDocument();
  });

  it('does not render when NPS already submitted (packConfig)', () => {
    mockUser.business.packConfig = {
      npsResponse: { score: 9, submittedAt: '2026-01-01' },
    };

    render(<NpsSurvey />);

    expect(screen.queryByTestId('nps-survey')).not.toBeInTheDocument();
  });

  it('renders all 11 score buttons (0-10)', () => {
    render(<NpsSurvey />);

    for (let i = 0; i <= 10; i++) {
      expect(screen.getByTestId(`nps-score-${i}`)).toBeInTheDocument();
    }
  });

  it('dismisses survey and tracks event', async () => {
    const user = userEvent.setup();
    render(<NpsSurvey />);

    await user.click(screen.getByTestId('nps-dismiss'));

    expect(screen.queryByTestId('nps-survey')).not.toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledWith('nps-survey-completed', 'dismissed');
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'nps_dismissed',
      expect.objectContaining({
        businessId: 'biz1',
      }),
    );
  });

  it('dismisses when clicking backdrop', async () => {
    const user = userEvent.setup();
    render(<NpsSurvey />);

    await user.click(screen.getByTestId('nps-backdrop'));

    expect(screen.queryByTestId('nps-survey')).not.toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledWith('nps-survey-completed', 'dismissed');
  });

  it('submit button is disabled when no score is selected', () => {
    render(<NpsSurvey />);

    expect(screen.getByTestId('nps-submit')).toBeDisabled();
  });

  it('submit button is enabled after selecting a score', async () => {
    const user = userEvent.setup();
    render(<NpsSurvey />);

    await user.click(screen.getByTestId('nps-score-8'));

    expect(screen.getByTestId('nps-submit')).not.toBeDisabled();
  });

  it('submits NPS score and feedback, tracks event', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ ok: true });
    render(<NpsSurvey />);

    await user.click(screen.getByTestId('nps-score-9'));
    await user.type(screen.getByTestId('nps-feedback'), 'Great tool!');
    await user.click(screen.getByTestId('nps-submit'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/business/nps', {
        score: 9,
        feedback: 'Great tool!',
      });
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('nps_submitted', {
      score: 9,
      hasFeedback: true,
      businessId: 'biz1',
    });
    expect(localStorageMock.setItem).toHaveBeenCalledWith('nps-survey-completed', 'submitted');
    expect(screen.getByTestId('nps-thank-you')).toBeInTheDocument();
  });

  it('submits NPS without feedback', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ ok: true });
    render(<NpsSurvey />);

    await user.click(screen.getByTestId('nps-score-3'));
    await user.click(screen.getByTestId('nps-submit'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/business/nps', {
        score: 3,
        feedback: undefined,
      });
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('nps_submitted', {
      score: 3,
      hasFeedback: false,
      businessId: 'biz1',
    });
  });

  it('does not render without business createdAt', () => {
    mockUser.business.createdAt = undefined;

    render(<NpsSurvey />);

    expect(screen.queryByTestId('nps-survey')).not.toBeInTheDocument();
  });
});

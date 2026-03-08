import { render, screen } from '@testing-library/react';
import { TrialBanner } from './trial-banner';

const mockUser: any = {
  id: '1',
  name: 'Sarah',
  role: 'ADMIN',
  businessId: 'b1',
  trial: {
    isTrial: true,
    trialDaysRemaining: 10,
    trialExpired: false,
    trialEndsAt: '2026-03-18T00:00:00Z',
    isGracePeriod: false,
  },
};

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('lucide-react', () => ({
  Clock: () => <span data-testid="clock-icon" />,
  AlertTriangle: () => <span data-testid="alert-icon" />,
  XCircle: () => <span data-testid="xcircle-icon" />,
}));

describe('TrialBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows trial days remaining', () => {
    render(<TrialBanner />);
    expect(screen.getByText(/10 days/)).toBeInTheDocument();
    expect(screen.getByText('Choose Plan')).toBeInTheDocument();
  });

  test('shows urgent styling when 3 days or less', () => {
    mockUser.trial = {
      ...mockUser.trial,
      trialDaysRemaining: 2,
    };

    render(<TrialBanner />);
    expect(screen.getByText(/2 days/)).toBeInTheDocument();
    expect(screen.getByText(/choose a plan to keep your data/)).toBeInTheDocument();
  });

  test('shows singular day text', () => {
    mockUser.trial = {
      ...mockUser.trial,
      trialDaysRemaining: 1,
    };

    render(<TrialBanner />);
    expect(screen.getByTestId('trial-banner')).toHaveTextContent('1 day left');
  });

  test('shows grace period banner', () => {
    mockUser.trial = {
      isTrial: false,
      trialDaysRemaining: 0,
      trialExpired: true,
      trialEndsAt: '2026-03-08T00:00:00Z',
      isGracePeriod: true,
    };

    render(<TrialBanner />);
    expect(screen.getByText(/trial has ended/)).toBeInTheDocument();
    expect(screen.getByText('Subscribe Now')).toBeInTheDocument();
  });

  test('renders nothing when no trial info', () => {
    mockUser.trial = undefined;

    const { container } = render(<TrialBanner />);
    expect(container.innerHTML).toBe('');
  });

  test('renders nothing when trial is over and not in grace period', () => {
    mockUser.trial = {
      isTrial: false,
      trialDaysRemaining: 0,
      trialExpired: true,
      trialEndsAt: '2026-03-01T00:00:00Z',
      isGracePeriod: false,
    };

    const { container } = render(<TrialBanner />);
    expect(container.innerHTML).toBe('');
  });

  test('links to billing settings page', () => {
    mockUser.trial = {
      isTrial: true,
      trialDaysRemaining: 7,
      trialExpired: false,
      trialEndsAt: '2026-03-15T00:00:00Z',
      isGracePeriod: false,
    };

    render(<TrialBanner />);
    const link = screen.getByText('Choose Plan');
    expect(link.closest('a')).toHaveAttribute('href', '/settings/billing');
  });
});

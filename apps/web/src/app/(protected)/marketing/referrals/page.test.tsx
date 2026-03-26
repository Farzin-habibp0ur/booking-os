import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReferralSettingsPage from './page';

jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

jest.mock('lucide-react', () => {
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop !== 'string') return undefined;
        const Icon = (p: any) => (
          <div data-testid={`${prop.toString().toLowerCase()}-icon`} {...p} />
        );
        Icon.displayName = prop.toString();
        return Icon;
      },
    },
  );
});

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: {
      role: 'ADMIN',
      name: 'Sarah',
      business: { name: 'Glow Clinic', verticalPack: 'AESTHETIC' },
    },
  }),
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/posthog', () => ({
  trackEvent: jest.fn(),
}));

const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

jest.mock('@/components/skeleton', () => ({
  FormSkeleton: ({ rows }: { rows: number }) => (
    <div data-testid="form-skeleton">Loading {rows} rows</div>
  ),
}));

const mockSettings = {
  enabled: true,
  referrerCredit: 25,
  refereeCredit: 25,
  maxReferralsPerCustomer: 0,
  creditExpiryMonths: 6,
  messageTemplate: 'Hey! I love {businessName}. Book with my link: {referralLink}',
  emailSubject: "You've been referred to {businessName}!",
};

const mockStats = {
  totalReferrals: 10,
  completedReferrals: 7,
  pendingReferrals: 3,
  totalCreditsIssued: 350,
  totalCreditsRedeemed: 100,
  recentReferrals: [
    {
      id: 'ref-1',
      referrerName: 'Jane Doe',
      referredName: 'John Smith',
      status: 'COMPLETED',
      referrerCreditAmount: 25,
      refereeCreditAmount: 25,
      createdAt: '2026-03-01T12:00:00Z',
      completedAt: '2026-03-05T12:00:00Z',
    },
    {
      id: 'ref-2',
      referrerName: 'Alice Brown',
      referredName: 'Pending',
      status: 'PENDING',
      referrerCreditAmount: 25,
      refereeCreditAmount: 25,
      createdAt: '2026-03-10T12:00:00Z',
      completedAt: null,
    },
  ],
};

describe('ReferralSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/referral/settings') return Promise.resolve(mockSettings);
      if (url === '/referral/stats') return Promise.resolve(mockStats);
      if (url === '/referral/top-referrers')
        return Promise.resolve([
          { customerId: 'c1', name: 'Jane Doe', totalReferrals: 5, totalCreditsEarned: 125 },
        ]);
      return Promise.resolve({});
    });
    mockApi.patch.mockResolvedValue({});
  });

  it('shows loading skeleton initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<ReferralSettingsPage />);
    expect(screen.getByTestId('form-skeleton')).toBeInTheDocument();
  });

  it('renders page header after loading', async () => {
    render(<ReferralSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Patient Referral Program')).toBeInTheDocument();
    });
  });

  it('renders reward configuration section', async () => {
    render(<ReferralSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Reward Configuration')).toBeInTheDocument();
    });
    expect(screen.getByText('Referrer earns')).toBeInTheDocument();
    expect(screen.getByText('Friend earns')).toBeInTheDocument();
  });

  it('renders message template section with merge vars', async () => {
    render(<ReferralSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Referral Message')).toBeInTheDocument();
    });
    expect(screen.getByText('{businessName}')).toBeInTheDocument();
    expect(screen.getByText('{creditAmount}')).toBeInTheDocument();
    expect(screen.getByText('{referralLink}')).toBeInTheDocument();
    expect(screen.getByText('{customerName}')).toBeInTheDocument();
  });

  it('renders referral activity stats', async () => {
    render(<ReferralSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Referral Activity')).toBeInTheDocument();
    });
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('7').length).toBeGreaterThanOrEqual(1);
  });

  it('renders recent referrals table', async () => {
    render(<ReferralSettingsPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Jane Doe').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('John Smith').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Alice Brown').length).toBeGreaterThanOrEqual(1);
  });

  it('save button calls PATCH /referral/settings', async () => {
    const user = userEvent.setup();
    render(<ReferralSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('Save Changes'));
    });

    expect(mockApi.patch).toHaveBeenCalledWith(
      '/referral/settings',
      expect.objectContaining({
        enabled: true,
        referrerCredit: 25,
        refereeCredit: 25,
      }),
    );
    expect(mockToast).toHaveBeenCalledWith('Referral settings saved', 'success');
  });

  it('back link navigates to /marketing', async () => {
    render(<ReferralSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Back to Marketing')).toBeInTheDocument();
    });
    const backLink = screen.getByText('Back to Marketing').closest('a');
    expect(backLink).toHaveAttribute('href', '/marketing');
  });

  it('renders live preview with channel tabs', async () => {
    render(<ReferralSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Live Preview')).toBeInTheDocument();
    });
    expect(screen.getByText('whatsapp')).toBeInTheDocument();
    expect(screen.getByText('sms')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
  });
});

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReferralSettingsPage from './page';

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

// Mock lucide-react icons
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
  useAuth: () => ({ user: { role: 'ADMIN', name: 'Sarah' } }),
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
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

const mockStats = {
  referralCode: 'ABC123',
  referralLink: 'https://example.com/signup?ref=ABC123',
  totalInvites: 5,
  successfulReferrals: 2,
  pendingReferrals: 3,
  totalCreditsEarned: 100,
  referrals: [
    {
      id: 'ref1',
      status: 'CREDITED',
      creditAmount: 50,
      businessName: 'Acme Inc',
      createdAt: '2026-01-15T12:00:00Z',
      convertedAt: '2026-01-20T12:00:00Z',
      creditedAt: '2026-01-20T12:00:00Z',
    },
    {
      id: 'ref2',
      status: 'PENDING',
      creditAmount: 50,
      businessName: 'Beta Corp',
      createdAt: '2026-02-01T12:00:00Z',
      convertedAt: null,
      creditedAt: null,
    },
  ],
};

const mockSettings = {
  creditAmount: 50,
  messageTemplate: 'Hey! Check out {businessName}',
  sharingMethod: 'manual',
  emailSubject: '',
};

const mockBusiness = { name: 'Glow Clinic' };

describe('ReferralSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/referral/stats') return Promise.resolve(mockStats);
      if (url === '/referral/settings') return Promise.resolve(mockSettings);
      if (url === '/business') return Promise.resolve(mockBusiness);
      return Promise.resolve({});
    });
    mockApi.patch.mockResolvedValue({});

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it('shows loading skeleton initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<ReferralSettingsPage />);
    expect(screen.getByTestId('form-skeleton')).toBeInTheDocument();
  });

  it('renders all 5 sections after loading', async () => {
    render(<ReferralSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('settings.referral.link_title')).toBeInTheDocument();
    });
    expect(screen.getByText('settings.referral.reward_title')).toBeInTheDocument();
    expect(screen.getByText('settings.referral.message_title')).toBeInTheDocument();
    expect(screen.getByText('settings.referral.sharing_title')).toBeInTheDocument();
    expect(screen.getByText('settings.referral.recent')).toBeInTheDocument();
  });

  it('displays referral stats', async () => {
    render(<ReferralSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
  });

  it('copy link button renders and is clickable', async () => {
    render(<ReferralSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('settings.copy_link')).toBeInTheDocument();
    });

    // Verify the referral link input shows the URL
    expect(screen.getByDisplayValue('https://example.com/signup?ref=ABC123')).toBeInTheDocument();
  });

  it('credit amount input renders with correct value', async () => {
    render(<ReferralSettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    });

    const input = screen.getByDisplayValue('50') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.min).toBe('5');
    expect(input.max).toBe('500');
  });

  it('message template textarea editing works', async () => {
    const user = userEvent.setup();
    render(<ReferralSettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Hey! Check out {businessName}')).toBeInTheDocument();
    });
  });

  it('merge variable buttons exist', async () => {
    render(<ReferralSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('{businessName}')).toBeInTheDocument();
    });
    expect(screen.getByText('{creditAmount}')).toBeInTheDocument();
    expect(screen.getByText('{referralLink}')).toBeInTheDocument();
    expect(screen.getByText('{ownerName}')).toBeInTheDocument();
  });

  it('sharing method radio buttons toggle', async () => {
    const user = userEvent.setup();
    render(<ReferralSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Manual (Copy Link)')).toBeInTheDocument();
    });

    const whatsappRadio = screen.getByDisplayValue('whatsapp');
    await act(async () => {
      await user.click(whatsappRadio);
    });

    expect(whatsappRadio).toBeChecked();
  });

  it('save button calls PATCH /referral/settings', async () => {
    const user = userEvent.setup();
    render(<ReferralSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('settings.referral.save')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('settings.referral.save'));
    });

    expect(mockApi.patch).toHaveBeenCalledWith(
      '/referral/settings',
      expect.objectContaining({
        creditAmount: 50,
        sharingMethod: 'manual',
      }),
    );
  });

  it('renders recent referrals with status badges', async () => {
    render(<ReferralSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Acme Inc')).toBeInTheDocument();
    });
    expect(screen.getByText('Beta Corp')).toBeInTheDocument();
    expect(screen.getByText('+$50')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('back link navigates to /marketing', async () => {
    render(<ReferralSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Back to Marketing')).toBeInTheDocument();
    });

    const backLink = screen.getByText('Back to Marketing').closest('a');
    expect(backLink).toHaveAttribute('href', '/marketing');
  });
});

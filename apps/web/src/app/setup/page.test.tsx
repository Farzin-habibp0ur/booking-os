import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => '/setup',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => {
  return ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
});

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      name: 'Sarah',
      role: 'ADMIN',
      businessId: 'b1',
      business: { id: 'b1', name: 'Test Clinic', verticalPack: 'general', packConfig: {} },
    },
    logout: jest.fn(),
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
  I18nProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
  ToastProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@booking-os/shared', () => ({
  PROFILE_FIELDS: [],
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockUpload = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args),
    upload: (...args: any[]) => mockUpload(...args),
  },
}));

jest.mock(
  'lucide-react',
  () =>
    new Proxy(
      {},
      {
        get: (_, name) => {
          if (name === '__esModule') return true;
          return (props: any) => <span data-icon={name as string} {...props} />;
        },
      },
    ),
);

import SetupPageWrapper from './page';

describe('SetupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default API responses
    mockGet.mockImplementation((url: string) => {
      if (url === '/business')
        return Promise.resolve({
          id: 'b1',
          name: 'Test Clinic',
          verticalPack: 'general',
          timezone: 'America/Los_Angeles',
          currency: 'USD',
          packConfig: {},
        });
      if (url === '/staff') return Promise.resolve([{ id: 's1', name: 'Sarah', role: 'ADMIN' }]);
      if (url === '/services') return Promise.resolve([]);
      if (url === '/templates') return Promise.resolve([]);
      if (url.includes('working-hours')) return Promise.resolve([]);
      return Promise.resolve({});
    });
  });

  it('renders the setup wizard with 6 progress steps', async () => {
    render(<SetupPageWrapper />);

    await waitFor(() => {
      // t() mock returns key string; step label uses setup.step_label
      expect(screen.getByText('setup.step_label')).toBeInTheDocument();
    });

    // 6 progress bar segments rendered as buttons
    const progressBtns = document.querySelectorAll('.flex.gap-1 button');
    expect(progressBtns.length).toBe(6);
  });

  it('shows time estimate badge on welcome step', async () => {
    render(<SetupPageWrapper />);

    await waitFor(() => {
      expect(screen.getByText('~2 min')).toBeInTheDocument();
    });
  });

  it('shows skip link on non-final steps', async () => {
    render(<SetupPageWrapper />);

    await waitFor(() => {
      expect(screen.getByText(/setup\.skip_for_now/)).toBeInTheDocument();
    });
  });

  it('skip advances to next step', async () => {
    render(<SetupPageWrapper />);

    await waitFor(() => {
      expect(screen.getByText('setup.clinic_type_title')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/setup\.skip_for_now/));

    // Step 1 shows business info title
    await waitFor(() => {
      expect(screen.getByText('setup.business_title')).toBeInTheDocument();
    });
  });

  it('navigates steps with Next button', async () => {
    render(<SetupPageWrapper />);

    await waitFor(() => {
      expect(screen.getByText('setup.clinic_type_title')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('common.next'));

    // Step 1 shows business info title
    await waitFor(() => {
      expect(screen.getByText('setup.business_title')).toBeInTheDocument();
    });
  });

  it('final step shows celebration and first-week checklist', async () => {
    render(<SetupPageWrapper />);

    await waitFor(() => {
      expect(screen.getByText(/setup\.skip_for_now/)).toBeInTheDocument();
    });

    for (let i = 0; i < 5; i++) {
      const skipButtons = screen.queryAllByText(/setup\.skip_for_now/);
      if (skipButtons.length > 0) {
        fireEvent.click(skipButtons[0]);
      } else {
        fireEvent.click(screen.getByText('common.next'));
      }
    }

    await waitFor(() => {
      expect(screen.getByText("You're all set! 🎉")).toBeInTheDocument();
    });

    expect(screen.getByTestId('first-week-checklist')).toBeInTheDocument();
    expect(screen.getByText('Send your first message')).toBeInTheDocument();
    expect(screen.getByText('Create a test booking')).toBeInTheDocument();
    expect(screen.getByText('Invite a team member')).toBeInTheDocument();
    expect(screen.getByText('Customize a template')).toBeInTheDocument();
    expect(screen.getByText('Enable AI auto-replies')).toBeInTheDocument();
  });

  it('final step has Go to Dashboard button', async () => {
    render(<SetupPageWrapper />);

    await waitFor(() => {
      expect(screen.getByText(/setup\.skip_for_now/)).toBeInTheDocument();
    });

    for (let i = 0; i < 5; i++) {
      const skipButtons = screen.queryAllByText(/setup\.skip_for_now/);
      if (skipButtons.length > 0) {
        fireEvent.click(skipButtons[0]);
      } else {
        fireEvent.click(screen.getByText('common.next'));
      }
    }

    await waitFor(() => {
      expect(screen.getByText('setup.go_to_dashboard')).toBeInTheDocument();
    });
  });

  it('back button is disabled on first step', async () => {
    render(<SetupPageWrapper />);

    await waitFor(() => {
      expect(screen.getByText('common.back')).toBeInTheDocument();
    });

    const backBtn = screen.getByText('common.back').closest('button');
    expect(backBtn).toBeDisabled();
  });
});

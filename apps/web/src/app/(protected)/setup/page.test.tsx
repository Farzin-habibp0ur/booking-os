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
    // Step 0 has no skip link — it has the pack install button instead.
    // Advance to step 1 by installing the aesthetic pack, then check for skip.
    mockPost.mockImplementation((url: string) => {
      if (url === '/business/install-pack')
        return Promise.resolve({ installed: { services: 5, templates: 3 } });
      return Promise.resolve({});
    });

    render(<SetupPageWrapper />);

    // Wait for step 0 to render and click the aesthetic pack button
    await waitFor(() => {
      expect(screen.getByText('setup.clinic_type_aesthetic')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('setup.clinic_type_aesthetic'));

    // After pack installs, a "Next" button appears inside the installed confirmation
    await waitFor(() => {
      expect(screen.getByText('setup.clinic_type_installed')).toBeInTheDocument();
    });

    // Click the inline Next button to advance to step 1
    const nextButtons = screen.getAllByText('common.next');
    // The inline next button in the installed confirmation card
    fireEvent.click(nextButtons[0]);

    // Step 1 should now show a skip link
    await waitFor(() => {
      expect(screen.getByText(/setup\.skip_for_now/)).toBeInTheDocument();
    });
  });

  it('skip advances to next step', async () => {
    // Advance past step 0 first by installing the pack
    mockPost.mockImplementation((url: string) => {
      if (url === '/business/install-pack')
        return Promise.resolve({ installed: { services: 5, templates: 3 } });
      return Promise.resolve({});
    });

    render(<SetupPageWrapper />);

    await waitFor(() => {
      expect(screen.getByText('setup.clinic_type_aesthetic')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('setup.clinic_type_aesthetic'));

    await waitFor(() => {
      expect(screen.getByText('setup.clinic_type_installed')).toBeInTheDocument();
    });

    // Click inline Next to go to step 1
    const nextButtons = screen.getAllByText('common.next');
    fireEvent.click(nextButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('setup.business_title')).toBeInTheDocument();
    });

    // Now click skip on step 1 to advance to step 2
    fireEvent.click(screen.getByText(/setup\.skip_for_now/));

    await waitFor(() => {
      expect(screen.getByText('setup.whatsapp_title')).toBeInTheDocument();
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
    // Advance past step 0 by installing the pack, then skip through remaining steps
    mockPost.mockImplementation((url: string) => {
      if (url === '/business/install-pack')
        return Promise.resolve({ installed: { services: 5, templates: 3 } });
      return Promise.resolve({});
    });

    render(<SetupPageWrapper />);

    // Step 0: install pack
    await waitFor(() => {
      expect(screen.getByText('setup.clinic_type_aesthetic')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('setup.clinic_type_aesthetic'));

    await waitFor(() => {
      expect(screen.getByText('setup.clinic_type_installed')).toBeInTheDocument();
    });

    // Click inline Next to go to step 1
    const nextButtons = screen.getAllByText('common.next');
    fireEvent.click(nextButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('setup.business_title')).toBeInTheDocument();
    });

    // Steps 1-4: skip or next through each
    for (let i = 0; i < 4; i++) {
      const skipButtons = screen.queryAllByText(/setup\.skip_for_now/);
      if (skipButtons.length > 0) {
        fireEvent.click(skipButtons[0]);
      } else {
        const footerNext = screen.getAllByText('common.next');
        fireEvent.click(footerNext[footerNext.length - 1]);
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
    // Advance past step 0 by installing the pack, then skip through remaining steps
    mockPost.mockImplementation((url: string) => {
      if (url === '/business/install-pack')
        return Promise.resolve({ installed: { services: 5, templates: 3 } });
      return Promise.resolve({});
    });

    render(<SetupPageWrapper />);

    // Step 0: install pack
    await waitFor(() => {
      expect(screen.getByText('setup.clinic_type_aesthetic')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('setup.clinic_type_aesthetic'));

    await waitFor(() => {
      expect(screen.getByText('setup.clinic_type_installed')).toBeInTheDocument();
    });

    // Click inline Next to go to step 1
    const nextButtons = screen.getAllByText('common.next');
    fireEvent.click(nextButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('setup.business_title')).toBeInTheDocument();
    });

    // Steps 1-4: skip or next through each
    for (let i = 0; i < 4; i++) {
      const skipButtons = screen.queryAllByText(/setup\.skip_for_now/);
      if (skipButtons.length > 0) {
        fireEvent.click(skipButtons[0]);
      } else {
        const footerNext = screen.getAllByText('common.next');
        fireEvent.click(footerNext[footerNext.length - 1]);
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

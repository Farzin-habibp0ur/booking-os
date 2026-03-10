import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('next/link', () => {
  return ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
});

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
  },
}));

const mockUser = {
  id: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'ADMIN',
  business: {
    id: 'b1',
    name: 'Test Biz',
    slug: 'test-biz',
    verticalPack: 'GENERAL',
    defaultLocale: 'en',
    packConfig: null,
    createdAt: '2025-01-01',
  },
};

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: mockUser }),
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

import { OnboardingWizard } from './onboarding-wizard';

describe('OnboardingWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const allIncomplete = {
    steps: {
      business_name: false,
      whatsapp_connected: false,
      staff_added: false,
      services_created: false,
      first_booking: false,
    },
  };

  const partialComplete = {
    steps: {
      business_name: true,
      whatsapp_connected: false,
      staff_added: true,
      services_created: true,
      first_booking: false,
    },
  };

  const allComplete = {
    steps: {
      business_name: true,
      whatsapp_connected: true,
      staff_added: true,
      services_created: true,
      first_booking: true,
    },
  };

  it('renders nothing when closed', () => {
    mockGet.mockResolvedValue(allIncomplete);

    render(<OnboardingWizard isOpen={false} onClose={jest.fn()} />);

    expect(screen.queryByTestId('onboarding-wizard')).not.toBeInTheDocument();
  });

  it('shows all 5 steps when open', async () => {
    mockGet.mockResolvedValue(allIncomplete);

    render(<OnboardingWizard isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Business Profile')).toBeInTheDocument();
    });

    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText('Availability')).toBeInTheDocument();
    expect(screen.getByText('Booking Portal')).toBeInTheDocument();
  });

  it('shows progress bar with correct percentage', async () => {
    mockGet.mockResolvedValue(partialComplete);

    render(<OnboardingWizard isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('3 of 5 steps completed')).toBeInTheDocument();
    });

    const progressBar = screen.getByTestId('wizard-progress-bar');
    expect(progressBar.style.width).toBe('60%');
  });

  it('shows completed checkmarks for done steps', async () => {
    mockGet.mockResolvedValue(partialComplete);

    render(<OnboardingWizard isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Business Profile')).toBeInTheDocument();
    });

    // Completed steps should have Check icons
    const businessStep = screen.getByTestId('wizard-step-business_name');
    expect(businessStep.querySelector('[data-icon="Check"]')).toBeInTheDocument();

    const servicesStep = screen.getByTestId('wizard-step-services_created');
    expect(servicesStep.querySelector('[data-icon="Check"]')).toBeInTheDocument();

    // Incomplete steps should have numbers
    const availabilityStep = screen.getByTestId('wizard-step-whatsapp_connected');
    expect(availabilityStep.querySelector('[data-icon="Check"]')).not.toBeInTheDocument();
  });

  it('"Skip for now" closes the wizard', async () => {
    mockGet.mockResolvedValue(allIncomplete);
    const onClose = jest.fn();

    render(<OnboardingWizard isOpen={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Skip for now')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Skip for now'));

    expect(onClose).toHaveBeenCalled();
  });

  it('step CTA buttons have correct hrefs', async () => {
    mockGet.mockResolvedValue(allIncomplete);

    render(<OnboardingWizard isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Business Profile')).toBeInTheDocument();
    });

    const ctaButtons = screen.getAllByText('Complete Setup');
    // 5 incomplete steps = 5 CTA buttons
    expect(ctaButtons).toHaveLength(5);

    // Check that each links to the correct page
    expect(ctaButtons[0].closest('a')).toHaveAttribute('href', '/settings');
    expect(ctaButtons[1].closest('a')).toHaveAttribute('href', '/services');
    expect(ctaButtons[2].closest('a')).toHaveAttribute('href', '/staff');
    expect(ctaButtons[3].closest('a')).toHaveAttribute('href', '/settings');
    expect(ctaButtons[4].closest('a')).toHaveAttribute('href', '/book/test-biz');
  });

  it('fetches onboarding status on mount', async () => {
    mockGet.mockResolvedValue(allIncomplete);

    render(<OnboardingWizard isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/business/onboarding-status');
    });
  });

  it('does not fetch when closed', () => {
    mockGet.mockResolvedValue(allIncomplete);

    render(<OnboardingWizard isOpen={false} onClose={jest.fn()} />);

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('hides CTA buttons for completed steps', async () => {
    mockGet.mockResolvedValue(partialComplete);

    render(<OnboardingWizard isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Business Profile')).toBeInTheDocument();
    });

    // 3 completed, 2 incomplete = 2 CTA buttons
    const ctaButtons = screen.getAllByText('Complete Setup');
    expect(ctaButtons).toHaveLength(2);
  });

  it('closes when backdrop is clicked', async () => {
    mockGet.mockResolvedValue(allIncomplete);
    const onClose = jest.fn();

    render(<OnboardingWizard isOpen={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('wizard-backdrop')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('wizard-backdrop'));

    expect(onClose).toHaveBeenCalled();
  });

  it('shows step descriptions', async () => {
    mockGet.mockResolvedValue(allIncomplete);

    render(<OnboardingWizard isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText('Set up your business name, logo, and contact info'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText('Add at least one service with name, duration, and price'),
    ).toBeInTheDocument();
    expect(screen.getByText('Invite or add team members')).toBeInTheDocument();
    expect(screen.getByText('Set your business hours and staff schedules')).toBeInTheDocument();
    expect(screen.getByText('Preview and customize your public booking page')).toBeInTheDocument();
  });

  it('gracefully handles API error', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    render(<OnboardingWizard isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Business Profile')).toBeInTheDocument();
    });

    // Should show all steps as incomplete on error
    expect(screen.getByText('0 of 5 steps completed')).toBeInTheDocument();
  });
});

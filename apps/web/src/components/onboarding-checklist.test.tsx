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

jest.mock('@/lib/design-tokens', () => ({
  ELEVATION: { cardSm: 'shadow-soft-sm rounded-xl' },
}));

const mockGet = jest.fn();
const mockPatch = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}));

jest.mock('lucide-react', () =>
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

import { OnboardingChecklist } from './onboarding-checklist';

describe('OnboardingChecklist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockPatch.mockResolvedValue({});
  });

  const allIncomplete = {
    steps: {
      business_name: false,
      whatsapp_connected: false,
      staff_added: false,
      services_created: false,
      templates_ready: false,
      first_booking: false,
    },
  };

  const partialComplete = {
    steps: {
      business_name: true,
      whatsapp_connected: true,
      staff_added: false,
      services_created: false,
      templates_ready: false,
      first_booking: false,
    },
  };

  const allComplete = {
    steps: {
      business_name: true,
      whatsapp_connected: true,
      staff_added: true,
      services_created: true,
      templates_ready: true,
      first_booking: true,
    },
  };

  it('renders with progress bar and step count', async () => {
    mockGet.mockResolvedValue(partialComplete);

    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('2 of 6 steps done')).toBeInTheDocument();
    });

    expect(screen.getByText('Getting Started')).toBeInTheDocument();
  });

  it('shows all 6 checklist items', async () => {
    mockGet.mockResolvedValue(allIncomplete);

    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Set up business profile')).toBeInTheDocument();
    });

    expect(screen.getByText('Connect WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Add staff members')).toBeInTheDocument();
    expect(screen.getByText('Create services')).toBeInTheDocument();
    expect(screen.getByText('Configure templates')).toBeInTheDocument();
    expect(screen.getByText('Make first booking')).toBeInTheDocument();
  });

  it('shows Complete Setup CTA when steps are incomplete', async () => {
    mockGet.mockResolvedValue(partialComplete);

    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Complete Setup')).toBeInTheDocument();
    });

    const cta = screen.getByText('Complete Setup');
    expect(cta.closest('a')).toHaveAttribute('href', '/setup');
  });

  it('hides Complete Setup CTA when all steps are complete', async () => {
    mockGet.mockResolvedValue(allComplete);

    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('6 of 6 steps done')).toBeInTheDocument();
    });

    expect(screen.queryByText('Complete Setup')).not.toBeInTheDocument();
  });

  it('dismiss hides widget and calls API', async () => {
    mockGet.mockResolvedValue(allIncomplete);

    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Dismiss'));

    await waitFor(() => {
      expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
    });

    expect(localStorage.getItem('onboarding-checklist-dismissed')).toBe('true');
    expect(mockPatch).toHaveBeenCalledWith('/business', { onboardingComplete: true });
  });

  it('does not render if previously dismissed via localStorage', async () => {
    localStorage.setItem('onboarding-checklist-dismissed', 'true');
    mockGet.mockResolvedValue(allIncomplete);

    render(<OnboardingChecklist />);

    // Give time for useEffect to run
    await new Promise((r) => setTimeout(r, 50));

    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
  });

  it('collapses and expands when header is clicked', async () => {
    mockGet.mockResolvedValue(partialComplete);

    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Set up business profile')).toBeInTheDocument();
    });

    // Click header to collapse
    fireEvent.click(screen.getByText('Getting Started'));

    expect(screen.queryByText('Set up business profile')).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(screen.getByText('Getting Started'));

    expect(screen.getByText('Set up business profile')).toBeInTheDocument();
  });

  it('checklist items link to correct pages', async () => {
    mockGet.mockResolvedValue(allIncomplete);

    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Connect WhatsApp')).toBeInTheDocument();
    });

    expect(screen.getByText('Connect WhatsApp').closest('a')).toHaveAttribute(
      'href',
      '/settings?tab=integrations',
    );
    expect(screen.getByText('Add staff members').closest('a')).toHaveAttribute('href', '/staff');
  });

  it('completed items have line-through styling', async () => {
    mockGet.mockResolvedValue(partialComplete);

    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Set up business profile')).toBeInTheDocument();
    });

    const completedItem = screen.getByText('Set up business profile');
    expect(completedItem.className).toContain('line-through');

    const incompleteItem = screen.getByText('Add staff members');
    expect(incompleteItem.className).not.toContain('line-through');
  });

  it('fetches onboarding status from API on mount', async () => {
    mockGet.mockResolvedValue(allIncomplete);

    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/business/onboarding-status');
    });
  });
});

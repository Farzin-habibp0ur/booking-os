jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), patch: jest.fn() },
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));
jest.mock('lucide-react', () => ({
  Sparkles: (p: any) => <span data-testid="icon-sparkles" {...p} />,
  CheckCircle: (p: any) => <span data-testid="icon-check" {...p} />,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, val: string) => {
      store[key] = val;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AISetupWizard } from './ai-setup-wizard';
import { api } from '@/lib/api';

const mockApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  // Default: /business returns a baseline of 80 bookings/month
  mockApi.get.mockResolvedValue({ baselineMonthlyBookings: 80 } as any);
});

describe('AISetupWizard', () => {
  it('renders the wizard with data-testid', () => {
    render(<AISetupWizard />);
    expect(screen.getByTestId('ai-setup-wizard')).toBeInTheDocument();
  });

  it('shows step 1 (Connect channels) on initial render', () => {
    render(<AISetupWizard />);
    expect(
      screen.getByRole('heading', { name: 'Connect front desk channels' }),
    ).toBeInTheDocument();
    // Channel toggles must be present per Phase 6 spec
    expect(screen.getByTestId('channel-toggle-INSTAGRAM')).toBeInTheDocument();
    expect(screen.getByTestId('channel-toggle-WHATSAPP')).toBeInTheDocument();
    expect(screen.getByTestId('channel-toggle-WEB_CHAT')).toBeInTheDocument();
    expect(screen.getByTestId('channel-toggle-SMS')).toBeInTheDocument();
    expect(screen.getByTestId('channel-toggle-EMAIL')).toBeInTheDocument();
  });

  it('navigates to next step (Set voice) when Next is clicked', () => {
    render(<AISetupWizard />);
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByRole('heading', { name: 'Set your clinic voice' })).toBeInTheDocument();
  });

  it('navigates back when Back is clicked', () => {
    render(<AISetupWizard />);
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByRole('heading', { name: 'Set your clinic voice' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('back-button'));
    expect(
      screen.getByRole('heading', { name: 'Connect front desk channels' }),
    ).toBeInTheDocument();
  });

  it('skip button sets localStorage and calls onComplete', () => {
    const onComplete = jest.fn();
    render(<AISetupWizard onComplete={onComplete} />);
    fireEvent.click(screen.getByTestId('skip-button'));
    expect(localStorageMock.setItem).toHaveBeenCalledWith('bookingos:ai-setup-dismissed', 'true');
    expect(onComplete).toHaveBeenCalled();
  });

  it('step 3 confirms approval mode is ON (autoReply.enabled = false)', () => {
    render(<AISetupWizard />);
    // Step 0 → 1 → 2 (approval mode)
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByRole('heading', { name: 'Confirm approval mode is ON' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('approval-confirm')).toBeChecked();
  });

  it('disables Next on step 3 if approval is unchecked', () => {
    render(<AISetupWizard />);
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('approval-confirm'));
    expect(screen.getByTestId('next-button')).toBeDisabled();
  });

  it('step 4 shows waitlist + cancellation fill toggles', () => {
    render(<AISetupWizard />);
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    expect(
      screen.getByRole('heading', { name: 'Enable waitlist + cancellation fill' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('waitlist-fill-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('cancellation-fill-toggle')).toBeInTheDocument();
  });

  it('step 5 displays the baseline as read-only (founder-set)', async () => {
    render(<AISetupWizard />);
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));

    expect(
      screen.getByRole('heading', { name: 'Confirm your pre-pilot baseline' }),
    ).toBeInTheDocument();
    // /business returns baselineMonthlyBookings: 80
    await waitFor(() => {
      expect(screen.getByTestId('baseline-display')).toHaveTextContent('80');
    });
    // No editable input — read-only
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('step 5 shows "Not set" when /business returns no baseline', async () => {
    mockApi.get.mockResolvedValueOnce({ baselineMonthlyBookings: null } as any);
    render(<AISetupWizard />);
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('baseline-display')).toHaveTextContent('Not set');
    });
  });

  it('calls PATCH /ai/settings with autoReply.enabled=false on completion', async () => {
    mockApi.patch.mockResolvedValue({});
    const onComplete = jest.fn();
    render(<AISetupWizard onComplete={onComplete} />);

    // Walk through all 5 steps
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.change(screen.getByTestId('personality-input'), {
      target: { value: 'friendly and professional' },
    });
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));

    fireEvent.click(screen.getByTestId('complete-button'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/ai/settings',
        expect.objectContaining({
          enabled: true,
          autoReplySuggestions: true,
          autoReply: expect.objectContaining({ enabled: false }),
          agents: expect.objectContaining({
            waitlistFillEnabled: true,
            cancellationFillEnabled: true,
          }),
        }),
      );
    });
  });

  it('sets localStorage on completion', async () => {
    mockApi.patch.mockResolvedValue({});
    render(<AISetupWizard />);

    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('complete-button'));

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('bookingos:ai-setup-dismissed', 'true');
    });
  });

  it('shows success state after completion', async () => {
    mockApi.patch.mockResolvedValue({});
    render(<AISetupWizard />);

    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('complete-button'));

    await waitFor(() => {
      expect(screen.getByText('AI Front Desk is ready!')).toBeInTheDocument();
    });
  });
});

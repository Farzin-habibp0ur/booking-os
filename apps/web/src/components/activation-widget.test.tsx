jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
    upload: jest.fn(),
    getText: jest.fn(),
  },
}));
jest.mock('@/lib/posthog', () => ({
  trackEvent: jest.fn(),
}));

import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { trackEvent } from '@/lib/posthog';
import { ActivationWidget } from './activation-widget';

const mockApi = api as jest.Mocked<typeof api>;
const mockTrackEvent = trackEvent as jest.MockedFunction<typeof trackEvent>;

const allFalseSteps = {
  real_booking: false,
  link_shared: false,
  notification_received: false,
  inbox_reply: false,
  briefing_viewed: false,
};

const someCompletedSteps = {
  real_booking: true,
  link_shared: true,
  notification_received: true,
  inbox_reply: false,
  briefing_viewed: false,
};

const allCompletedSteps = {
  real_booking: true,
  link_shared: true,
  notification_received: true,
  inbox_reply: true,
  briefing_viewed: true,
};

describe('ActivationWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('returns null when dismissed via localStorage', async () => {
    localStorage.setItem('activation-widget-dismissed', 'true');

    const { container } = render(<ActivationWidget />);

    // Allow useEffect to run
    await act(async () => {});

    expect(container.innerHTML).toBe('');
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('renders with 0 of 5 completed', async () => {
    mockApi.get.mockResolvedValue({ steps: allFalseSteps });

    render(<ActivationWidget />);

    await waitFor(() => {
      expect(screen.getByText('0 of 5 completed')).toBeInTheDocument();
    });

    expect(screen.getByText('Get Started')).toBeInTheDocument();
    expect(screen.getByText('Create a real booking')).toBeInTheDocument();
    expect(screen.getByText('Share your booking link')).toBeInTheDocument();
    expect(screen.getByText('Receive a booking notification')).toBeInTheDocument();
    expect(screen.getByText('Reply to a message')).toBeInTheDocument();
    expect(screen.getByText('View your Daily Briefing')).toBeInTheDocument();
  });

  it('renders completed steps with checkmarks', async () => {
    mockApi.get.mockResolvedValue({ steps: someCompletedSteps });

    render(<ActivationWidget />);

    await waitFor(() => {
      expect(screen.getByText('3 of 5 completed')).toBeInTheDocument();
    });

    // Completed steps should have line-through class
    const completedLabels = [
      'Create a real booking',
      'Share your booking link',
      'Receive a booking notification',
    ];
    for (const label of completedLabels) {
      const el = screen.getByText(label);
      expect(el).toHaveClass('line-through');
    }

    // Incomplete steps should NOT have line-through
    const incompleteLabels = ['Reply to a message', 'View your Daily Briefing'];
    for (const label of incompleteLabels) {
      const el = screen.getByText(label);
      expect(el).not.toHaveClass('line-through');
    }
  });

  it('tracks activation_milestone_reached when 3+ steps completed', async () => {
    mockApi.get.mockResolvedValue({ steps: someCompletedSteps });

    render(<ActivationWidget />);

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('activation_milestone_reached', { completed: 3 });
    });
  });

  it('does not track milestone when less than 3 steps completed', async () => {
    mockApi.get.mockResolvedValue({
      steps: { ...allFalseSteps, real_booking: true },
    });

    render(<ActivationWidget />);

    await waitFor(() => {
      expect(screen.getByText('1 of 5 completed')).toBeInTheDocument();
    });

    expect(mockTrackEvent).not.toHaveBeenCalledWith(
      'activation_milestone_reached',
      expect.anything(),
    );
  });

  it('dismiss button sets localStorage and hides widget', async () => {
    mockApi.get.mockResolvedValue({ steps: allFalseSteps });
    const user = userEvent.setup();

    render(<ActivationWidget />);

    await waitFor(() => {
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    const dismissBtn = screen.getByLabelText('Dismiss activation checklist');
    await user.click(dismissBtn);

    expect(localStorage.getItem('activation-widget-dismissed')).toBe('true');
    expect(screen.queryByText('Get Started')).not.toBeInTheDocument();
  });

  it('collapse/expand toggle works', async () => {
    mockApi.get.mockResolvedValue({ steps: allFalseSteps });
    const user = userEvent.setup();

    render(<ActivationWidget />);

    await waitFor(() => {
      expect(screen.getByText('Create a real booking')).toBeInTheDocument();
    });

    // Steps are visible initially (expanded)
    expect(screen.getByText('Create a real booking')).toBeVisible();

    // Click header to collapse
    const header = screen.getByText('Get Started').closest('button')!;
    await user.click(header);

    // Steps should be hidden
    expect(screen.queryByText('Create a real booking')).not.toBeInTheDocument();

    // Click header to expand again
    await user.click(header);

    // Steps should be visible again
    expect(screen.getByText('Create a real booking')).toBeInTheDocument();
  });

  it('links to correct pages', async () => {
    mockApi.get.mockResolvedValue({ steps: allFalseSteps });

    render(<ActivationWidget />);

    await waitFor(() => {
      expect(screen.getByText('Create a real booking')).toBeInTheDocument();
    });

    const expectedLinks: Record<string, string> = {
      'Create a real booking': '/calendar',
      'Share your booking link': '/settings',
      'Receive a booking notification': '/bookings',
      'Reply to a message': '/inbox',
      'View your Daily Briefing': '/dashboard',
    };

    for (const [label, href] of Object.entries(expectedLinks)) {
      const link = screen.getByText(label).closest('a');
      expect(link).toHaveAttribute('href', href);
    }
  });

  it('handles API error gracefully', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));

    const { container } = render(<ActivationWidget />);

    // On error, component sets dismissed=true and returns null
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('returns null when all steps are completed (auto-dismiss)', async () => {
    mockApi.get.mockResolvedValue({ steps: allCompletedSteps });

    const { container } = render(<ActivationWidget />);

    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });

    expect(localStorage.getItem('activation-widget-dismissed')).toBe('true');
  });

  it('tracks activation_action_clicked on step click', async () => {
    mockApi.get.mockResolvedValue({ steps: allFalseSteps });
    const user = userEvent.setup();

    render(<ActivationWidget />);

    await waitFor(() => {
      expect(screen.getByText('Create a real booking')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Create a real booking'));

    expect(mockTrackEvent).toHaveBeenCalledWith('activation_action_clicked', {
      action: 'real_booking',
    });
  });

  it('calls the correct API endpoint', async () => {
    mockApi.get.mockResolvedValue({ steps: allFalseSteps });

    render(<ActivationWidget />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/business/activation-status');
    });
  });
});

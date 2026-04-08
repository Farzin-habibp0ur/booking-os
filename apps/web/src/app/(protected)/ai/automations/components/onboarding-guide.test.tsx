import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingGuide } from './onboarding-guide';

jest.mock('lucide-react', () => ({
  Sparkles: (props: any) => <svg data-testid="sparkles-icon" {...props} />,
  ChevronRight: (props: any) => <svg data-testid="chevron-right" {...props} />,
  CheckCircle: (props: any) => <svg data-testid="check-circle" {...props} />,
  X: (props: any) => <svg data-testid="x-icon" {...props} />,
}));

const STORAGE_KEY = 'bookingos:automation-onboarding-done';

const mockPlaybooks = [
  {
    playbook: 'no-show-prevention',
    name: 'No-Show Prevention',
    description: 'Send reminders before appointments',
    isActive: false,
  },
  {
    playbook: 'consult-conversion',
    name: 'Consult Conversion',
    description: 'Follow up after consultations',
    isActive: false,
  },
];

describe('OnboardingGuide', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the intro step when no active playbooks', () => {
    render(<OnboardingGuide playbooks={mockPlaybooks} onActivatePlaybook={jest.fn()} />);
    expect(screen.getByText('Get started with automations')).toBeInTheDocument();
  });

  it('does not render when a playbook is already active', () => {
    const activePlaybooks = [{ ...mockPlaybooks[0], isActive: true }, mockPlaybooks[1]];
    const { container } = render(
      <OnboardingGuide playbooks={activePlaybooks} onActivatePlaybook={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('does not render when previously dismissed', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { container } = render(
      <OnboardingGuide playbooks={mockPlaybooks} onActivatePlaybook={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows recommendation step when Get started is clicked', () => {
    render(<OnboardingGuide playbooks={mockPlaybooks} onActivatePlaybook={jest.fn()} />);
    fireEvent.click(screen.getByText('Get started'));
    expect(screen.getByText('We recommend: No-Show Prevention')).toBeInTheDocument();
  });

  it('calls onActivatePlaybook and shows success step', async () => {
    const onActivate = jest.fn().mockResolvedValue(undefined);
    render(<OnboardingGuide playbooks={mockPlaybooks} onActivatePlaybook={onActivate} />);

    fireEvent.click(screen.getByText('Get started'));
    fireEvent.click(screen.getByTestId('activate-recommended'));

    await waitFor(() => {
      expect(onActivate).toHaveBeenCalledWith('no-show-prevention');
      expect(screen.getByText('Your first automation is live!')).toBeInTheDocument();
    });
  });

  it('dismisses and saves to localStorage', () => {
    render(<OnboardingGuide playbooks={mockPlaybooks} onActivatePlaybook={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });
});

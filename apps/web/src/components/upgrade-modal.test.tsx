import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpgradeModal } from './upgrade-modal';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('lucide-react', () => ({
  Lock: () => <span data-testid="lock-icon" />,
  X: () => <span data-testid="x-icon" />,
  Sparkles: () => <span data-testid="sparkles-icon" />,
  Check: () => <span data-testid="check-icon" />,
}));

describe('UpgradeModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders nothing when not open', () => {
    const { container } = render(
      <UpgradeModal isOpen={false} onClose={jest.fn()} feature="whatsappInbox" />,
    );
    expect(container.innerHTML).toBe('');
  });

  test('renders feature name and plan', () => {
    render(
      <UpgradeModal isOpen={true} onClose={jest.fn()} feature="whatsappInbox" />,
    );
    expect(screen.getByText('Upgrade to Professional')).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp messages/)).toBeInTheDocument();
  });

  test('renders enterprise plan for enterprise features', () => {
    render(
      <UpgradeModal
        isOpen={true}
        onClose={jest.fn()}
        feature="apiAccess"
        requiredPlan="enterprise"
      />,
    );
    expect(screen.getByText('Upgrade to Enterprise')).toBeInTheDocument();
  });

  test('calls onClose and navigates to billing on View Plans click', async () => {
    const onClose = jest.fn();
    render(
      <UpgradeModal isOpen={true} onClose={onClose} feature="campaigns" />,
    );

    await userEvent.click(screen.getByText('View Plans'));

    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/settings/billing');
  });

  test('calls onClose on Maybe Later click', async () => {
    const onClose = jest.fn();
    render(
      <UpgradeModal isOpen={true} onClose={onClose} feature="campaigns" />,
    );

    await userEvent.click(screen.getByText('Maybe Later'));

    expect(onClose).toHaveBeenCalled();
  });

  test('shows professional plan features by default', () => {
    render(
      <UpgradeModal isOpen={true} onClose={jest.fn()} feature="campaigns" />,
    );
    expect(screen.getByText('WhatsApp inbox')).toBeInTheDocument();
    expect(screen.getByText('AI auto-replies')).toBeInTheDocument();
  });

  test('shows enterprise plan features when requiredPlan is enterprise', () => {
    render(
      <UpgradeModal
        isOpen={true}
        onClose={jest.fn()}
        feature="multiLocation"
        requiredPlan="enterprise"
      />,
    );
    expect(screen.getByText('Multi-location support')).toBeInTheDocument();
    expect(screen.getByText('API access')).toBeInTheDocument();
  });
});

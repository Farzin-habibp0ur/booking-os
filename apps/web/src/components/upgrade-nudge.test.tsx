import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpgradeNudge } from './upgrade-nudge';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('lucide-react', () => ({
  TrendingUp: () => <span data-testid="trending-up-icon" />,
  AlertTriangle: () => <span data-testid="alert-triangle-icon" />,
  X: () => <span data-testid="x-icon" />,
}));

describe('UpgradeNudge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders nothing when below 80% threshold', () => {
    const { container } = render(
      <UpgradeNudge current={100} plan="starter" resource="bookings" resourceLabel="bookings" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders near-limit nudge at 80%', () => {
    render(
      <UpgradeNudge current={400} plan="starter" resource="bookings" resourceLabel="bookings" />,
    );
    expect(screen.getByTestId('upgrade-nudge')).toBeInTheDocument();
    expect(screen.getByText(/80%/)).toBeInTheDocument();
    expect(screen.getByText(/Upgrade to Professional/)).toBeInTheDocument();
  });

  it('renders at-limit nudge with amber styling when at limit', () => {
    render(
      <UpgradeNudge current={500} plan="starter" resource="bookings" resourceLabel="bookings" />,
    );
    const nudge = screen.getByTestId('upgrade-nudge');
    expect(nudge).toBeInTheDocument();
    expect(nudge.className).toContain('amber');
    expect(screen.getByText(/reached your bookings limit/)).toBeInTheDocument();
  });

  it('renders nothing for enterprise plan', () => {
    const { container } = render(
      <UpgradeNudge
        current={99999}
        plan="enterprise"
        resource="bookings"
        resourceLabel="bookings"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('navigates to billing on Upgrade Now click', async () => {
    render(
      <UpgradeNudge current={400} plan="starter" resource="bookings" resourceLabel="bookings" />,
    );
    await userEvent.click(screen.getByTestId('upgrade-nudge-cta'));
    expect(mockPush).toHaveBeenCalledWith('/settings/billing');
  });

  it('dismisses to sessionStorage and hides', async () => {
    render(
      <UpgradeNudge current={400} plan="starter" resource="bookings" resourceLabel="bookings" />,
    );
    expect(screen.getByTestId('upgrade-nudge')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('upgrade-nudge-dismiss'));

    expect(screen.queryByTestId('upgrade-nudge')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('upgrade-nudge-dismissed-bookings')).toBe('1');
  });

  it('stays hidden if sessionStorage already has dismissal', () => {
    sessionStorage.setItem('upgrade-nudge-dismissed-bookings', '1');

    const { container } = render(
      <UpgradeNudge current={400} plan="starter" resource="bookings" resourceLabel="bookings" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows lavender styling for near-limit (not at limit)', () => {
    render(
      <UpgradeNudge current={400} plan="starter" resource="bookings" resourceLabel="bookings" />,
    );
    const nudge = screen.getByTestId('upgrade-nudge');
    expect(nudge.className).toContain('lavender');
  });
});

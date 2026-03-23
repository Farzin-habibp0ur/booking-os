import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HelpPage from './page';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('HelpPage', () => {
  it('renders help center title', () => {
    render(<HelpPage />);
    expect(screen.getByText('Help Center')).toBeInTheDocument();
    expect(screen.getByText('Find answers to common questions')).toBeInTheDocument();
  });

  it('shows all FAQ sections', () => {
    render(<HelpPage />);
    expect(screen.getByText('How to create a booking')).toBeInTheDocument();
    expect(screen.getByText('How to set up services')).toBeInTheDocument();
    expect(screen.getByText('How to manage staff schedules')).toBeInTheDocument();
    expect(screen.getByText('How to configure the booking portal')).toBeInTheDocument();
    expect(screen.getByText('How to set up payment processing')).toBeInTheDocument();
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
  });

  it('expands FAQ item on click', async () => {
    const user = userEvent.setup();
    render(<HelpPage />);

    // Initially no answer visible
    expect(screen.queryByText(/Navigate to the Bookings page/)).not.toBeInTheDocument();

    // Click the first FAQ
    await user.click(screen.getByText('How to create a booking'));

    // Answer should now be visible
    expect(screen.getByText(/Navigate to the Bookings page/)).toBeInTheDocument();
  });

  it('collapses FAQ item on second click', async () => {
    const user = userEvent.setup();
    render(<HelpPage />);

    // Expand
    await user.click(screen.getByText('How to create a booking'));
    expect(screen.getByText(/Navigate to the Bookings page/)).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByText('How to create a booking'));
    expect(screen.queryByText(/Navigate to the Bookings page/)).not.toBeInTheDocument();
  });

  it('can expand multiple FAQ items independently', async () => {
    const user = userEvent.setup();
    render(<HelpPage />);

    await user.click(screen.getByText('How to create a booking'));
    await user.click(screen.getByText('How to set up services'));

    expect(screen.getByText(/Navigate to the Bookings page/)).toBeInTheDocument();
    expect(screen.getByText(/Go to the Services page/)).toBeInTheDocument();
  });

  it('FAQ toggle buttons have aria-expanded attribute', async () => {
    const user = userEvent.setup();
    render(<HelpPage />);

    const button = screen.getByText('How to create a booking').closest('button')!;
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});

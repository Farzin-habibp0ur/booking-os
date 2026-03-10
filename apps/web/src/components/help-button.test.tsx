import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpButton } from './help-button';

const mockStartTour = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

jest.mock('@/components/demo-tour', () => ({
  useDemoTour: () => ({ state: 'idle', startTour: mockStartTour }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('HelpButton', () => {
  beforeEach(() => {
    mockStartTour.mockClear();
  });

  it('renders the floating help button', () => {
    render(<HelpButton />);
    expect(screen.getByTestId('help-button')).toBeInTheDocument();
    expect(screen.getByLabelText('Help & Support')).toBeInTheDocument();
  });

  it('opens panel on click', async () => {
    const user = userEvent.setup();
    render(<HelpButton />);

    expect(screen.queryByTestId('help-panel')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('help-button'));

    expect(screen.getByTestId('help-panel')).toBeInTheDocument();
    expect(screen.getByText('Help & Support')).toBeInTheDocument();
  });

  it('shows quick links in the panel', async () => {
    const user = userEvent.setup();
    render(<HelpButton />);

    await user.click(screen.getByTestId('help-button'));

    expect(screen.getByText('Getting Started Guide')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Start Demo Tour')).toBeInTheDocument();
    expect(screen.getByText('Contact Support')).toBeInTheDocument();
    expect(screen.getByText('Feature Requests')).toBeInTheDocument();
  });

  it('shows search input', async () => {
    const user = userEvent.setup();
    render(<HelpButton />);

    await user.click(screen.getByTestId('help-button'));

    expect(screen.getByPlaceholderText('Search help articles...')).toBeInTheDocument();
  });

  it('closes panel on Escape', async () => {
    const user = userEvent.setup();
    render(<HelpButton />);

    await user.click(screen.getByTestId('help-button'));
    expect(screen.getByTestId('help-panel')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('help-panel')).not.toBeInTheDocument();
  });

  it('closes panel on close button click', async () => {
    const user = userEvent.setup();
    render(<HelpButton />);

    await user.click(screen.getByTestId('help-button'));
    expect(screen.getByTestId('help-panel')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Close help panel'));
    expect(screen.queryByTestId('help-panel')).not.toBeInTheDocument();
  });

  it('has Start Demo Tour link', async () => {
    const user = userEvent.setup();
    render(<HelpButton />);

    await user.click(screen.getByTestId('help-button'));

    const tourButton = screen.getByTestId('help-link-start-demo-tour');
    expect(tourButton).toBeInTheDocument();
  });

  it('calls startTour when Start Demo Tour is clicked', async () => {
    const user = userEvent.setup();
    render(<HelpButton />);

    await user.click(screen.getByTestId('help-button'));
    await user.click(screen.getByTestId('help-link-start-demo-tour'));

    expect(mockStartTour).toHaveBeenCalled();
  });

  it('opens shortcuts modal when Keyboard Shortcuts is clicked', async () => {
    const user = userEvent.setup();
    render(<HelpButton />);

    await user.click(screen.getByTestId('help-button'));
    await user.click(screen.getByTestId('help-link-keyboard-shortcuts'));

    // Panel should close and shortcuts modal should open
    expect(screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeInTheDocument();
  });

  it('shortcuts modal lists all shortcuts', async () => {
    const user = userEvent.setup();
    render(<HelpButton />);

    await user.click(screen.getByTestId('help-button'));
    await user.click(screen.getByTestId('help-link-keyboard-shortcuts'));

    const modal = screen.getByRole('dialog', { name: 'Keyboard Shortcuts' });
    expect(within(modal).getByText('Search')).toBeInTheDocument();
    expect(within(modal).getByText('Help')).toBeInTheDocument();
    expect(within(modal).getByText('Close modal/panel')).toBeInTheDocument();
    expect(within(modal).getByText('Move down in list')).toBeInTheDocument();
    expect(within(modal).getByText('Open selected item')).toBeInTheDocument();
  });

  it('? key opens help panel when not in an input', async () => {
    const user = userEvent.setup();
    render(<HelpButton />);

    expect(screen.queryByTestId('help-panel')).not.toBeInTheDocument();

    // Simulate ? key (Shift+/)
    await user.keyboard('?');

    expect(screen.getByTestId('help-panel')).toBeInTheDocument();
  });

  it('? key does not open help panel when focused in an input', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <input data-testid="test-input" />
        <HelpButton />
      </div>,
    );

    const input = screen.getByTestId('test-input');
    await user.click(input);
    await user.keyboard('?');

    expect(screen.queryByTestId('help-panel')).not.toBeInTheDocument();
  });

  it('Getting Started Guide links to /help', async () => {
    const user = userEvent.setup();
    render(<HelpButton />);

    await user.click(screen.getByTestId('help-button'));

    const link = screen.getByTestId('help-link-getting-started-guide');
    expect(link).toHaveAttribute('href', '/help');
  });

  it('Contact Support links to mailto', async () => {
    const user = userEvent.setup();
    render(<HelpButton />);

    await user.click(screen.getByTestId('help-button'));

    const link = screen.getByTestId('help-link-contact-support');
    expect(link).toHaveAttribute('href', 'mailto:support@bookingos.com');
  });

  it('Feature Requests links to mailto', async () => {
    const user = userEvent.setup();
    render(<HelpButton />);

    await user.click(screen.getByTestId('help-button'));

    const link = screen.getByTestId('help-link-feature-requests');
    expect(link).toHaveAttribute('href', 'mailto:feedback@bookingos.com');
  });
});

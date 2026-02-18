import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModeSwitcher from './mode-switcher';

const mockSetMode = jest.fn();

jest.mock('@/lib/use-mode', () => ({
  useMode: () => ({
    mode: 'admin',
    setMode: mockSetMode,
    availableModes: [
      { key: 'admin', labels: { general: 'Admin' }, allowedRoles: ['ADMIN'] },
      { key: 'agent', labels: { general: 'Agent' }, allowedRoles: ['ADMIN', 'AGENT'] },
      { key: 'provider', labels: { general: 'Provider' }, allowedRoles: ['ADMIN', 'SERVICE_PROVIDER'] },
    ],
    modeLabel: 'Admin',
    landingPath: '/dashboard',
    modeDef: { key: 'admin' },
  }),
}));

jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
  }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('ModeSwitcher', () => {
  beforeEach(() => {
    mockSetMode.mockClear();
  });

  it('renders all available mode tabs', () => {
    render(<ModeSwitcher />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Provider')).toBeInTheDocument();
  });

  it('marks current mode as selected', () => {
    render(<ModeSwitcher />);

    const adminTab = screen.getByText('Admin');
    expect(adminTab.closest('[role="tab"]')).toHaveAttribute('aria-selected', 'true');
  });

  it('calls setMode when clicking a different mode', async () => {
    render(<ModeSwitcher />);

    await userEvent.click(screen.getByText('Agent'));

    expect(mockSetMode).toHaveBeenCalledWith('agent');
  });
});

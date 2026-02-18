import { render, screen } from '@testing-library/react';
import ModeSwitcher from './mode-switcher';

// Mock single-mode scenario (SERVICE_PROVIDER)
jest.mock('@/lib/use-mode', () => ({
  useMode: () => ({
    mode: 'provider',
    setMode: jest.fn(),
    availableModes: [
      { key: 'provider', labels: { general: 'Provider' }, allowedRoles: ['SERVICE_PROVIDER'] },
    ],
    modeLabel: 'Provider',
    landingPath: '/calendar',
    modeDef: { key: 'provider' },
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

describe('ModeSwitcher - single mode', () => {
  it('renders nothing when only one mode available', () => {
    const { container } = render(<ModeSwitcher />);
    expect(container.firstChild).toBeNull();
  });
});

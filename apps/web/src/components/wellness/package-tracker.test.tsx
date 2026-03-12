import { render, screen, waitFor } from '@testing-library/react';
import PackageTracker from './package-tracker';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { apiFetch } = require('@/lib/api');

describe('PackageTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with static props', () => {
    render(
      <PackageTracker
        sessions={{ total: 10, used: 3, packageName: '10-Session Massage Package' }}
      />,
    );
    expect(screen.getByTestId('package-tracker')).toBeInTheDocument();
    expect(screen.getByText('10-Session Massage Package')).toBeInTheDocument();
    expect(screen.getByText('3 of 10 sessions used')).toBeInTheDocument();
    expect(screen.getByText('7 remaining')).toBeInTheDocument();
  });

  it('fetches data from API when customerId provided', async () => {
    apiFetch.mockResolvedValue([
      {
        id: 'pur-1',
        totalSessions: 10,
        usedSessions: 4,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'ACTIVE',
        package: { name: 'Yoga Package' },
      },
    ]);

    render(<PackageTracker customerId="cust-1" />);

    await waitFor(() => {
      expect(screen.getByText('Yoga Package')).toBeInTheDocument();
    });
    expect(screen.getByText('4 of 10 sessions used')).toBeInTheDocument();
    expect(screen.getByText('6 remaining')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/packages/customer/cust-1/active');
  });

  it('shows loading state', () => {
    apiFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<PackageTracker customerId="cust-1" />);
    expect(screen.getByTestId('package-tracker')).toBeInTheDocument();
  });

  it('shows progress percentage', () => {
    render(<PackageTracker sessions={{ total: 10, used: 5, packageName: 'Package' }} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows 0% for zero total', () => {
    render(<PackageTracker sessions={{ total: 0, used: 0, packageName: 'Package' }} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows expiry warning when expiring soon', () => {
    const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    render(
      <PackageTracker sessions={{ total: 10, used: 8, packageName: 'Package', expiresAt: soon }} />,
    );
    expect(screen.getByText(/Expires/)).toBeInTheDocument();
  });

  it('does not show expiry warning when not expiring soon', () => {
    const farFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    render(
      <PackageTracker
        sessions={{ total: 10, used: 3, packageName: 'Package', expiresAt: farFuture }}
      />,
    );
    expect(screen.queryByText(/Expires/)).not.toBeInTheDocument();
  });

  it('renders nothing if no data and no props', () => {
    apiFetch.mockResolvedValue([]);
    const { container } = render(<PackageTracker />);
    expect(container.innerHTML).toBe('');
  });

  it('renders multiple purchases from API', async () => {
    apiFetch.mockResolvedValue([
      {
        id: 'pur-1',
        totalSessions: 10,
        usedSessions: 3,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'ACTIVE',
        package: { name: 'Massage 10-Pack' },
      },
      {
        id: 'pur-2',
        totalSessions: 5,
        usedSessions: 1,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'ACTIVE',
        package: { name: 'Yoga 5-Pack' },
      },
    ]);

    render(<PackageTracker customerId="cust-1" />);

    await waitFor(() => {
      expect(screen.getByText('Massage 10-Pack')).toBeInTheDocument();
    });
    expect(screen.getByText('Yoga 5-Pack')).toBeInTheDocument();
  });
});

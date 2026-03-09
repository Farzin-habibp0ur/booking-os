import { render, screen } from '@testing-library/react';
import PackageTracker from './package-tracker';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('PackageTracker', () => {
  it('renders package tracker', () => {
    render(
      <PackageTracker
        sessions={{ total: 10, used: 3, packageName: '10-Session Massage Package' }}
      />,
    );
    expect(screen.getByTestId('package-tracker')).toBeInTheDocument();
    expect(screen.getByText('Session Package')).toBeInTheDocument();
  });

  it('displays package name', () => {
    render(
      <PackageTracker
        sessions={{ total: 10, used: 3, packageName: '10-Session Massage Package' }}
      />,
    );
    expect(screen.getByText('10-Session Massage Package')).toBeInTheDocument();
  });

  it('shows session count', () => {
    render(<PackageTracker sessions={{ total: 10, used: 3, packageName: 'Package' }} />);
    expect(screen.getByText('3 of 10 sessions used')).toBeInTheDocument();
    expect(screen.getByText('7 remaining')).toBeInTheDocument();
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

  it('shows high usage at 80%+', () => {
    render(<PackageTracker sessions={{ total: 10, used: 9, packageName: 'Package' }} />);
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('1 remaining')).toBeInTheDocument();
  });
});

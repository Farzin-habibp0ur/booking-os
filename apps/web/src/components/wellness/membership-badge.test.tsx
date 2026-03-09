import { render, screen } from '@testing-library/react';
import MembershipBadge from './membership-badge';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('MembershipBadge', () => {
  it('renders VIP badge', () => {
    render(<MembershipBadge type="VIP" />);
    expect(screen.getByTestId('membership-badge')).toBeInTheDocument();
    expect(screen.getByText('VIP')).toBeInTheDocument();
  });

  it('renders Annual badge', () => {
    render(<MembershipBadge type="Annual" />);
    expect(screen.getByText('Annual')).toBeInTheDocument();
  });

  it('renders Monthly badge', () => {
    render(<MembershipBadge type="Monthly" />);
    expect(screen.getByText('Monthly')).toBeInTheDocument();
  });

  it('renders Drop-in badge', () => {
    render(<MembershipBadge type="Drop-in" />);
    expect(screen.getByText('Drop-in')).toBeInTheDocument();
  });

  it('renders unknown type with Drop-in styling', () => {
    render(<MembershipBadge type="Custom" />);
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByTestId('membership-badge')).toBeInTheDocument();
  });

  it('supports md size', () => {
    render(<MembershipBadge type="VIP" size="md" />);
    const badge = screen.getByTestId('membership-badge');
    expect(badge.className).toContain('text-xs');
  });

  it('defaults to sm size', () => {
    render(<MembershipBadge type="VIP" />);
    const badge = screen.getByTestId('membership-badge');
    expect(badge.className).toContain('text-[10px]');
  });
});

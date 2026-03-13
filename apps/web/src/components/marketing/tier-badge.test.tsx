jest.mock('@/lib/cn', () => ({ cn: (...args) => args.filter(Boolean).join(' ') }));

import { render, screen } from '@testing-library/react';
import { TierBadge } from './tier-badge';

describe('TierBadge', () => {
  it('renders GREEN tier with sage colors', () => {
    render(<TierBadge tier="GREEN" />);
    const badge = screen.getByTestId('tier-badge');
    expect(badge).toHaveTextContent('GREEN');
    expect(badge.className).toContain('bg-green-50');
    expect(badge.className).toContain('text-green-700');
  });

  it('renders YELLOW tier with amber colors', () => {
    render(<TierBadge tier="YELLOW" />);
    const badge = screen.getByTestId('tier-badge');
    expect(badge).toHaveTextContent('YELLOW');
    expect(badge.className).toContain('bg-amber-50');
    expect(badge.className).toContain('text-amber-700');
  });

  it('renders RED tier with red colors', () => {
    render(<TierBadge tier="RED" />);
    const badge = screen.getByTestId('tier-badge');
    expect(badge).toHaveTextContent('RED');
    expect(badge.className).toContain('bg-red-50');
    expect(badge.className).toContain('text-red-700');
  });

  it('renders sm size by default', () => {
    render(<TierBadge tier="GREEN" />);
    const badge = screen.getByTestId('tier-badge');
    expect(badge.className).toContain('text-[10px]');
  });

  it('renders md size when specified', () => {
    render(<TierBadge tier="GREEN" size="md" />);
    const badge = screen.getByTestId('tier-badge');
    expect(badge.className).toContain('text-xs');
  });

  it('applies custom className', () => {
    render(<TierBadge tier="GREEN" className="custom-class" />);
    const badge = screen.getByTestId('tier-badge');
    expect(badge.className).toContain('custom-class');
  });

  it('returns null for invalid tier', () => {
    const { container } = render(<TierBadge tier={'INVALID' as any} />);
    expect(container.innerHTML).toBe('');
  });
});

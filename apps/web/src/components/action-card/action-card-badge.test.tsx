import { render, screen } from '@testing-library/react';
import { ActionCardBadge } from './action-card-badge';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('ActionCardBadge', () => {
  it('renders count when count > 0', () => {
    render(<ActionCardBadge count={5} />);

    expect(screen.getByTestId('action-card-badge')).toHaveTextContent('5');
  });

  it('returns null when count is 0', () => {
    const { container } = render(<ActionCardBadge count={0} />);

    expect(container.firstChild).toBeNull();
  });

  it('applies custom className', () => {
    render(<ActionCardBadge count={3} className="ml-2" />);

    expect(screen.getByTestId('action-card-badge')).toBeInTheDocument();
  });
});

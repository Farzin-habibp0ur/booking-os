import { render, screen } from '@testing-library/react';
import { AutonomyBadge } from './autonomy-badge';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('AutonomyBadge', () => {
  it('renders OFF level', () => {
    render(<AutonomyBadge level="OFF" />);
    expect(screen.getByTestId('autonomy-badge')).toHaveTextContent('Off');
  });

  it('renders ASSISTED level', () => {
    render(<AutonomyBadge level="ASSISTED" />);
    expect(screen.getByTestId('autonomy-badge')).toHaveTextContent('Assisted');
  });

  it('renders AUTO level', () => {
    render(<AutonomyBadge level="AUTO" />);
    expect(screen.getByTestId('autonomy-badge')).toHaveTextContent('Auto');
  });

  it('defaults to ASSISTED for unknown level', () => {
    render(<AutonomyBadge level="UNKNOWN" />);
    expect(screen.getByTestId('autonomy-badge')).toHaveTextContent('Assisted');
  });
});

import { render, screen } from '@testing-library/react';
import { AiStateIndicator } from './ai-state-indicator';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('AiStateIndicator', () => {
  it('renders drafting state', () => {
    render(<AiStateIndicator state="drafting" />);

    expect(screen.getByTestId('ai-state-indicator')).toHaveTextContent('AI drafting');
  });

  it('renders paused state', () => {
    render(<AiStateIndicator state="paused" />);

    expect(screen.getByTestId('ai-state-indicator')).toHaveTextContent('AI paused');
  });

  it('renders human takeover state', () => {
    render(<AiStateIndicator state="human_takeover" />);

    expect(screen.getByTestId('ai-state-indicator')).toHaveTextContent('Human takeover');
  });

  it('applies custom className', () => {
    render(<AiStateIndicator state="drafting" className="ml-2" />);

    expect(screen.getByTestId('ai-state-indicator')).toBeInTheDocument();
  });
});

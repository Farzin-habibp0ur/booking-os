jest.mock('@/lib/cn', () => ({ cn: (...args) => args.filter(Boolean).join(' ') }));
jest.mock('lucide-react', () => ({
  Shield: () => <span data-testid="shield-icon" />,
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { AutonomyLevelSelector, AUTONOMY_LEVELS } from './autonomy-level-selector';

describe('AutonomyLevelSelector', () => {
  const onChange = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders 4 level buttons', () => {
    render(<AutonomyLevelSelector value="OFF" onChange={onChange} />);
    expect(screen.getByTestId('autonomy-level-selector')).toBeInTheDocument();
    expect(screen.getByTestId('level-OFF')).toBeInTheDocument();
    expect(screen.getByTestId('level-SUGGEST')).toBeInTheDocument();
    expect(screen.getByTestId('level-AUTO_WITH_REVIEW')).toBeInTheDocument();
    expect(screen.getByTestId('level-FULL_AUTO')).toBeInTheDocument();
  });

  it('highlights active level', () => {
    render(<AutonomyLevelSelector value="SUGGEST" onChange={onChange} />);
    const btn = screen.getByTestId('level-SUGGEST');
    expect(btn.className).toContain('ring-2');
  });

  it('calls onChange when level clicked', () => {
    render(<AutonomyLevelSelector value="OFF" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('level-FULL_AUTO'));
    expect(onChange).toHaveBeenCalledWith('FULL_AUTO');
  });

  it('shows recommended badge', () => {
    render(<AutonomyLevelSelector value="OFF" onChange={onChange} recommended="SUGGEST" />);
    expect(screen.getByTestId('recommended-badge')).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('does not show recommended badge when not matching', () => {
    render(<AutonomyLevelSelector value="OFF" onChange={onChange} recommended="OFF" />);
    // Only one recommended badge for OFF
    const badges = screen.getAllByTestId('recommended-badge');
    expect(badges).toHaveLength(1);
  });

  it('disables all buttons when disabled', () => {
    render(<AutonomyLevelSelector value="OFF" onChange={onChange} disabled />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('does not call onChange when disabled', () => {
    render(<AutonomyLevelSelector value="OFF" onChange={onChange} disabled />);
    fireEvent.click(screen.getByTestId('level-SUGGEST'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows description text for each level', () => {
    render(<AutonomyLevelSelector value="OFF" onChange={onChange} />);
    expect(screen.getByText('Disabled — no automated actions')).toBeInTheDocument();
    expect(screen.getByText('Suggests actions for human approval')).toBeInTheDocument();
    expect(screen.getByText('Fully autonomous — no human review')).toBeInTheDocument();
  });

  it('exports AUTONOMY_LEVELS with 4 entries', () => {
    expect(AUTONOMY_LEVELS).toHaveLength(4);
  });
});

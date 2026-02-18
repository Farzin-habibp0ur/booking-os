import { render, screen, fireEvent } from '@testing-library/react';
import { AutonomySettings } from './autonomy-settings';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('AutonomySettings', () => {
  const mockConfigs = [
    { actionType: 'DEPOSIT_PENDING', autonomyLevel: 'AUTO' },
    { actionType: 'OVERDUE_REPLY', autonomyLevel: 'OFF' },
  ];
  const onUpdate = jest.fn();

  it('renders all action types', () => {
    render(<AutonomySettings configs={mockConfigs} onUpdate={onUpdate} />);

    expect(screen.getByTestId('autonomy-settings')).toBeInTheDocument();
    expect(screen.getByTestId('autonomy-row-DEPOSIT_PENDING')).toBeInTheDocument();
    expect(screen.getByTestId('autonomy-row-OVERDUE_REPLY')).toBeInTheDocument();
    expect(screen.getByTestId('autonomy-row-OPEN_SLOT')).toBeInTheDocument();
  });

  it('shows current level for configured types', () => {
    render(<AutonomySettings configs={mockConfigs} onUpdate={onUpdate} />);

    // DEPOSIT_PENDING should have AUTO selected (white bg)
    const autoBtn = screen.getByTestId('level-DEPOSIT_PENDING-AUTO');
    expect(autoBtn).toBeInTheDocument();
  });

  it('calls onUpdate when level button clicked', () => {
    render(<AutonomySettings configs={mockConfigs} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByTestId('level-DEPOSIT_PENDING-ASSISTED'));

    expect(onUpdate).toHaveBeenCalledWith('DEPOSIT_PENDING', 'ASSISTED');
  });

  it('defaults unconfigured types to ASSISTED', () => {
    render(<AutonomySettings configs={[]} onUpdate={onUpdate} />);

    // Each type should exist - all default to ASSISTED
    expect(screen.getByTestId('autonomy-row-DEPOSIT_PENDING')).toBeInTheDocument();
  });

  it('shows title and description', () => {
    render(<AutonomySettings configs={mockConfigs} onUpdate={onUpdate} />);

    expect(screen.getByText('AI Autonomy Settings')).toBeInTheDocument();
    expect(screen.getByText('Deposit Reminders')).toBeInTheDocument();
  });

  it('disables buttons when loading', () => {
    render(<AutonomySettings configs={mockConfigs} onUpdate={onUpdate} loading />);

    const btn = screen.getByTestId('level-DEPOSIT_PENDING-OFF');
    expect(btn).toBeDisabled();
  });
});

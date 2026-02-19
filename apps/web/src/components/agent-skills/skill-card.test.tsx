jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));

import { render, screen, fireEvent } from '@testing-library/react';
import { SkillCard } from './skill-card';

const baseSkill = {
  agentType: 'WAITLIST',
  name: 'Waitlist Matching',
  description: 'Automatically matches waitlisted patients',
  category: 'proactive' as const,
  isEnabled: true,
  autonomyLevel: 'SUGGEST',
  hasConfig: false,
};

describe('SkillCard', () => {
  const onToggle = jest.fn();
  const onAutonomyChange = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders skill name and description', () => {
    render(<SkillCard skill={baseSkill} onToggle={onToggle} onAutonomyChange={onAutonomyChange} />);
    expect(screen.getByText('Waitlist Matching')).toBeInTheDocument();
    expect(screen.getByText(/Automatically matches/)).toBeInTheDocument();
  });

  it('shows category badge', () => {
    render(<SkillCard skill={baseSkill} onToggle={onToggle} onAutonomyChange={onAutonomyChange} />);
    expect(screen.getByText('Proactive')).toBeInTheDocument();
  });

  it('shows reactive category', () => {
    render(
      <SkillCard
        skill={{ ...baseSkill, category: 'reactive' }}
        onToggle={onToggle}
        onAutonomyChange={onAutonomyChange}
      />,
    );
    expect(screen.getByText('Reactive')).toBeInTheDocument();
  });

  it('shows maintenance category', () => {
    render(
      <SkillCard
        skill={{ ...baseSkill, category: 'maintenance' }}
        onToggle={onToggle}
        onAutonomyChange={onAutonomyChange}
      />,
    );
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
  });

  it('calls onToggle when checkbox is clicked', () => {
    render(<SkillCard skill={baseSkill} onToggle={onToggle} onAutonomyChange={onAutonomyChange} />);
    fireEvent.click(screen.getByTestId('toggle-WAITLIST'));
    expect(onToggle).toHaveBeenCalledWith('WAITLIST', false);
  });

  it('shows autonomy select when enabled', () => {
    render(<SkillCard skill={baseSkill} onToggle={onToggle} onAutonomyChange={onAutonomyChange} />);
    expect(screen.getByTestId('autonomy-select-WAITLIST')).toBeInTheDocument();
  });

  it('hides autonomy select when disabled', () => {
    render(
      <SkillCard
        skill={{ ...baseSkill, isEnabled: false }}
        onToggle={onToggle}
        onAutonomyChange={onAutonomyChange}
      />,
    );
    expect(screen.queryByTestId('autonomy-select-WAITLIST')).not.toBeInTheDocument();
  });

  it('calls onAutonomyChange when select changes', () => {
    render(<SkillCard skill={baseSkill} onToggle={onToggle} onAutonomyChange={onAutonomyChange} />);
    fireEvent.change(screen.getByTestId('autonomy-select-WAITLIST'), {
      target: { value: 'AUTO' },
    });
    expect(onAutonomyChange).toHaveBeenCalledWith('WAITLIST', 'AUTO');
  });

  it('applies reduced opacity when disabled', () => {
    render(
      <SkillCard
        skill={{ ...baseSkill, isEnabled: false }}
        onToggle={onToggle}
        onAutonomyChange={onAutonomyChange}
      />,
    );
    const card = screen.getByTestId('skill-card-WAITLIST');
    expect(card.className).toContain('opacity-60');
  });

  it('does not apply reduced opacity when enabled', () => {
    render(<SkillCard skill={baseSkill} onToggle={onToggle} onAutonomyChange={onAutonomyChange} />);
    const card = screen.getByTestId('skill-card-WAITLIST');
    expect(card.className).not.toContain('opacity-60');
  });
});

'use client';

interface SkillCardProps {
  skill: {
    agentType: string;
    name: string;
    description: string;
    category: 'proactive' | 'reactive' | 'maintenance';
    isEnabled: boolean;
    autonomyLevel: string;
    hasConfig: boolean;
  };
  onToggle: (agentType: string, enabled: boolean) => void;
  onAutonomyChange: (agentType: string, level: string) => void;
  disabled?: boolean;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  proactive: { bg: 'bg-sage-50', text: 'text-sage-700', label: 'Proactive' },
  reactive: { bg: 'bg-lavender-50', text: 'text-lavender-700', label: 'Reactive' },
  maintenance: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Maintenance' },
};

const AUTONOMY_LEVELS = [
  { value: 'SUGGEST', label: 'Suggest Only' },
  { value: 'REQUIRE_APPROVAL', label: 'Require Approval' },
  { value: 'AUTO', label: 'Fully Automatic' },
];

export function SkillCard({ skill, onToggle, onAutonomyChange, disabled }: SkillCardProps) {
  const categoryStyle = CATEGORY_STYLES[skill.category] || CATEGORY_STYLES.maintenance;

  return (
    <div
      data-testid={`skill-card-${skill.agentType}`}
      className={`bg-white rounded-2xl shadow-soft p-5 transition-opacity ${
        !skill.isEnabled ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-900">{skill.name}</h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${categoryStyle.bg} ${categoryStyle.text}`}
            >
              {categoryStyle.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3">{skill.description}</p>

          {skill.isEnabled && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Autonomy:</label>
              <select
                value={skill.autonomyLevel}
                onChange={(e) => onAutonomyChange(skill.agentType, e.target.value)}
                disabled={disabled}
                className="text-xs bg-slate-50 border-transparent rounded-lg px-2 py-1 focus:ring-2 focus:ring-sage-500 focus:bg-white"
                data-testid={`autonomy-select-${skill.agentType}`}
              >
                {AUTONOMY_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={skill.isEnabled}
            onChange={(e) => onToggle(skill.agentType, e.target.checked)}
            disabled={disabled}
            className="sr-only peer"
            data-testid={`toggle-${skill.agentType}`}
          />
          <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-sage-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sage-600" />
        </label>
      </div>
    </div>
  );
}

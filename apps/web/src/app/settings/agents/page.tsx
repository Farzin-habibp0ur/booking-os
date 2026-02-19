'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/toast';
import { api } from '@/lib/api';
import { SkillCard } from '@/components/agent-skills/skill-card';
import { Bot } from 'lucide-react';

interface AgentSkill {
  agentType: string;
  name: string;
  description: string;
  category: 'proactive' | 'reactive' | 'maintenance';
  isEnabled: boolean;
  autonomyLevel: string;
  hasConfig: boolean;
}

export default function AgentSkillsPage() {
  const { toast } = useToast();
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await api.get<AgentSkill[]>('/agent-skills');
      setSkills(Array.isArray(res) ? res : []);
    } catch (err: any) {
      toast('Failed to load agent skills', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleToggle = async (agentType: string, enabled: boolean) => {
    setUpdating(agentType);
    try {
      await api.patch(`/agent-skills/${agentType}/${enabled ? 'enable' : 'disable'}`);
      setSkills((prev) =>
        prev.map((s) => (s.agentType === agentType ? { ...s, isEnabled: enabled, hasConfig: true } : s)),
      );
      toast(`${agentType} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      toast(`Failed to ${enabled ? 'enable' : 'disable'} skill`, 'error');
    } finally {
      setUpdating(null);
    }
  };

  const handleAutonomyChange = async (agentType: string, level: string) => {
    setUpdating(agentType);
    try {
      await api.patch(`/agent-skills/${agentType}/config`, { autonomyLevel: level });
      setSkills((prev) =>
        prev.map((s) => (s.agentType === agentType ? { ...s, autonomyLevel: level, hasConfig: true } : s)),
      );
      toast('Autonomy level updated');
    } catch (err: any) {
      toast('Failed to update autonomy level', 'error');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const proactive = skills.filter((s) => s.category === 'proactive');
  const reactive = skills.filter((s) => s.category === 'reactive');
  const maintenance = skills.filter((s) => s.category === 'maintenance');

  return (
    <div className="p-6 max-w-3xl" data-testid="agent-skills-page">
      <div className="flex items-center gap-2 mb-6">
        <Bot size={24} className="text-lavender-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">Agent Skills</h1>
      </div>

      <p className="text-sm text-slate-500 mb-6">
        Configure which AI agents are active for your business and their autonomy levels.
      </p>

      {skills.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
          <p className="text-slate-400">No agent skills available for your plan.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {proactive.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-slate-700 mb-3">Proactive Agents</h2>
              <div className="space-y-3">
                {proactive.map((skill) => (
                  <SkillCard
                    key={skill.agentType}
                    skill={skill}
                    onToggle={handleToggle}
                    onAutonomyChange={handleAutonomyChange}
                    disabled={updating === skill.agentType}
                  />
                ))}
              </div>
            </section>
          )}

          {reactive.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-slate-700 mb-3">Reactive Agents</h2>
              <div className="space-y-3">
                {reactive.map((skill) => (
                  <SkillCard
                    key={skill.agentType}
                    skill={skill}
                    onToggle={handleToggle}
                    onAutonomyChange={handleAutonomyChange}
                    disabled={updating === skill.agentType}
                  />
                ))}
              </div>
            </section>
          )}

          {maintenance.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-slate-700 mb-3">Maintenance Agents</h2>
              <div className="space-y-3">
                {maintenance.map((skill) => (
                  <SkillCard
                    key={skill.agentType}
                    skill={skill}
                    onToggle={handleToggle}
                    onAutonomyChange={handleAutonomyChange}
                    disabled={updating === skill.agentType}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

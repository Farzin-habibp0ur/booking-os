'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/lib/toast';
import { api } from '@/lib/api';
import { ListSkeleton } from '@/components/skeleton';
import { SkillCard } from '@/components/agent-skills/skill-card';
import { Bot, ArrowLeft } from 'lucide-react';

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

  const fetchData = useCallback(async () => {
    try {
      const skillsRes = await api.get<AgentSkill[]>('/agent-skills').catch(() => []);
      setSkills(Array.isArray(skillsRes) ? skillsRes : []);
    } catch {
      toast('Failed to load agent settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (agentType: string, enabled: boolean) => {
    setUpdating(agentType);
    try {
      await api.patch(`/agent-skills/${agentType}/${enabled ? 'enable' : 'disable'}`);
      setSkills((prev) =>
        prev.map((s) =>
          s.agentType === agentType ? { ...s, isEnabled: enabled, hasConfig: true } : s,
        ),
      );
      toast(`${agentType} ${enabled ? 'enabled' : 'disabled'}`);
    } catch {
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
        prev.map((s) =>
          s.agentType === agentType ? { ...s, autonomyLevel: level, hasConfig: true } : s,
        ),
      );
      toast('Autonomy level updated');
    } catch {
      toast('Failed to update autonomy level', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const proactive = skills.filter((s) => s.category === 'proactive');
  const reactive = skills.filter((s) => s.category === 'reactive');
  const maintenance = skills.filter((s) => s.category === 'maintenance');

  if (loading) return <ListSkeleton rows={4} />;

  return (
    <div className="max-w-3xl p-6" data-testid="agent-skills-page">
      <Link
        href="/settings"
        className="mb-3 inline-flex items-center gap-1 text-sm text-sage-600 transition-colors hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300"
      >
        <ArrowLeft size={14} />
        Back to Settings
      </Link>
      <div className="mb-6 flex items-center gap-2">
        <Bot size={24} className="text-lavender-600" />
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Agent Skills</h1>
      </div>

      <p className="mb-6 text-sm text-slate-500">
        Configure which AI agents are active for your business and their autonomy levels.
      </p>

      {/* Operational Agent Skills */}
      {skills.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-soft">
          <p className="text-slate-400">No agent skills available for your plan.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {proactive.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-slate-700">Proactive Agents</h2>
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
              <h2 className="mb-3 text-sm font-medium text-slate-700">Reactive Agents</h2>
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
              <h2 className="mb-3 text-sm font-medium text-slate-700">Maintenance Agents</h2>
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

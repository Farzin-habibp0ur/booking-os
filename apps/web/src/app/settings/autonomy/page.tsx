'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { AutonomySettings } from '@/components/autonomy';
import { api } from '@/lib/api';

export default function AutonomySettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await api.get<any[]>('/autonomy');
      setConfigs(Array.isArray(res) ? res : []);
    } catch (err: any) {
      toast('Failed to load autonomy settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleUpdate = async (actionType: string, level: string) => {
    setUpdating(true);
    try {
      await api.patch(`/autonomy/${actionType}`, { autonomyLevel: level });
      setConfigs((prev) => {
        const existing = prev.find((c) => c.actionType === actionType);
        if (existing) {
          return prev.map((c) =>
            c.actionType === actionType ? { ...c, autonomyLevel: level } : c,
          );
        }
        return [...prev, { actionType, autonomyLevel: level }];
      });
      toast('Autonomy level updated');
    } catch (err: any) {
      toast('Failed to update autonomy level', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl" data-testid="autonomy-settings-page">
      <AutonomySettings configs={configs} onUpdate={handleUpdate} loading={updating} />
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/lib/toast';
import { AutonomySettings } from '@/components/autonomy';
import { api } from '@/lib/api';
import { FormSkeleton } from '@/components/skeleton';
import { ArrowLeft } from 'lucide-react';

export default function AutonomySettingsPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await api.get<any[]>('/autonomy');
      setConfigs(Array.isArray(res) ? res : []);
    } catch {
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
    } catch {
      toast('Failed to update autonomy level', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <FormSkeleton rows={3} />;

  return (
    <div className="max-w-3xl p-6" data-testid="autonomy-settings-page">
      <Link
        href="/settings"
        className="mb-3 inline-flex items-center gap-1 text-sm text-sage-600 transition-colors hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300"
      >
        <ArrowLeft size={14} />
        Back to Settings
      </Link>

      {/* Operational Autonomy */}
      <AutonomySettings configs={configs} onUpdate={handleUpdate} loading={updating} />
    </div>
  );
}

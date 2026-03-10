'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { AutonomySettings } from '@/components/autonomy';
import { api } from '@/lib/api';
import { FormSkeleton } from '@/components/skeleton';
import { ArrowLeft } from 'lucide-react';

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
    return <FormSkeleton rows={3} />;
  }

  return (
    <div className="p-6 max-w-3xl" data-testid="autonomy-settings-page">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Settings
      </Link>
      <AutonomySettings configs={configs} onUpdate={handleUpdate} loading={updating} />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  message?: string;
  latencyMs?: number;
}

interface HealthData {
  status: 'healthy' | 'degraded' | 'down';
  checks: HealthCheck[];
  businessHealth: {
    green: number;
    yellow: number;
    red: number;
    total: number;
  };
  checkedAt: string;
}

const STATUS_CONFIG = {
  healthy: {
    icon: CheckCircle2,
    color: 'text-sage-600',
    bg: 'bg-sage-50 dark:bg-sage-900/20',
    border: 'border-sage-200 dark:border-sage-800',
    label: 'Healthy',
    dot: 'bg-sage-500',
  },
  degraded: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'Degraded',
    dot: 'bg-amber-500',
  },
  down: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    label: 'Down',
    dot: 'bg-red-500',
  },
};

export default function ConsoleHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const result = await api.get<HealthData>('/admin/health');
      setData(result);
    } catch (err) {
      console.error('Failed to fetch health', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  if (loading && !data) {
    return (
      <div className="p-6 md:p-8 max-w-5xl">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">System Health</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 md:p-8 max-w-5xl">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">System Health</h1>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-8 text-center">
          <XCircle className="mx-auto text-red-400 mb-4" size={48} />
          <p className="text-sm text-slate-500">Failed to load health data.</p>
        </div>
      </div>
    );
  }

  const overallConfig = STATUS_CONFIG[data.status];
  const OverallIcon = overallConfig.icon;

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white">System Health</h1>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Overall Status Banner */}
      <div className={`rounded-2xl border ${overallConfig.border} ${overallConfig.bg} p-6 mb-6`}>
        <div className="flex items-center gap-3">
          <OverallIcon className={overallConfig.color} size={32} />
          <div>
            <p className={`text-lg font-semibold ${overallConfig.color}`}>
              System is {overallConfig.label}
            </p>
            <p className="text-sm text-slate-500">
              Last checked: {new Date(data.checkedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Service Checks */}
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Service Checks</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {data.checks.map((check) => {
          const config = STATUS_CONFIG[check.status];
          const CheckIcon = config.icon;
          return (
            <div key={check.name} className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{check.name}</h3>
                </div>
                <CheckIcon className={config.color} size={18} />
              </div>
              <p className="text-sm text-slate-500">{check.message}</p>
              {check.latencyMs !== undefined && (
                <p className="text-xs text-slate-400 mt-1">Latency: {check.latencyMs}ms</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Business Health Distribution */}
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Business Health Distribution</h2>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-sage-500" />
              <span className="text-sm text-slate-500">Healthy</span>
            </div>
            <p className="text-2xl font-serif font-bold text-sage-700 dark:text-sage-400">{data.businessHealth.green}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm text-slate-500">At Risk</span>
            </div>
            <p className="text-2xl font-serif font-bold text-amber-700 dark:text-amber-400">{data.businessHealth.yellow}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm text-slate-500">Critical</span>
            </div>
            <p className="text-2xl font-serif font-bold text-red-700 dark:text-red-400">{data.businessHealth.red}</p>
          </div>
        </div>

        {/* Health Bar */}
        {data.businessHealth.total > 0 && (
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-sage-500 transition-all"
              style={{ width: `${(data.businessHealth.green / data.businessHealth.total) * 100}%` }}
            />
            <div
              className="bg-amber-500 transition-all"
              style={{ width: `${(data.businessHealth.yellow / data.businessHealth.total) * 100}%` }}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${(data.businessHealth.red / data.businessHealth.total) * 100}%` }}
            />
          </div>
        )}
        <p className="text-xs text-slate-400 mt-2 text-center">{data.businessHealth.total} total businesses</p>
      </div>
    </div>
  );
}

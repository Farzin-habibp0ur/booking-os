'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  Database,
  Zap,
  BarChart3,
  Clock,
} from 'lucide-react';

interface SystemStatusResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  environment: string;
  services: {
    [key: string]: {
      status: string;
      latencyMs: number;
    };
  };
  cron: {
    enabled: boolean;
    jobCount: number;
  };
  workers: {
    queuesRegistered: string[];
  };
  memory: {
    rss: string;
    heapUsed: string;
    heapTotal: string;
  };
  timestamp: string;
}

const STATUS_CONFIG = {
  healthy: {
    icon: CheckCircle2,
    color: 'text-sage-600 dark:text-sage-400',
    bg: 'bg-sage-50 dark:bg-sage-900/20',
    border: 'border-sage-200 dark:border-sage-800',
    label: 'Healthy',
    dot: 'bg-sage-500',
    textColor: 'text-sage-700 dark:text-sage-300',
  },
  degraded: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'Degraded',
    dot: 'bg-amber-500',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
  unhealthy: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    label: 'Unhealthy',
    dot: 'bg-red-500',
    textColor: 'text-red-700 dark:text-red-300',
  },
  ok: {
    icon: CheckCircle2,
    color: 'text-sage-600 dark:text-sage-400',
    dot: 'bg-sage-500',
    label: 'OK',
  },
  error: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'Error',
  },
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(' ') : '< 1m';
}

function parseMemoryValue(value: string): number {
  const match = value.match(/^([\d.]+)\s*([A-Z]B)?$/i);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const unit = match[2]?.toUpperCase() || 'MB';

  const unitMap: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };

  return num * (unitMap[unit] || 1024 * 1024);
}

export default function SystemStatusPage() {
  const [data, setData] = useState<SystemStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const result = await api.get<SystemStatusResponse>('/system-status');
      setData(result);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch system status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading && !data) {
    return (
      <div className="p-6 md:p-8 max-w-6xl">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
          System Status
        </h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 md:p-8 max-w-6xl">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
          System Status
        </h1>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-8 text-center">
          <XCircle className="mx-auto text-red-400 mb-4" size={48} />
          <p className="text-sm text-slate-500">Failed to load system status.</p>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[data.status];
  const StatusIcon = statusConfig.icon;

  const heapUsedBytes = parseMemoryValue(data.memory.heapUsed);
  const heapTotalBytes = parseMemoryValue(data.memory.heapTotal);
  const heapUsagePercent =
    heapTotalBytes > 0 ? Math.round((heapUsedBytes / heapTotalBytes) * 100) : 0;

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white">
          System Status
        </h1>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Overall Status Banner */}
      <div className={`rounded-2xl border ${statusConfig.border} ${statusConfig.bg} p-6 mb-6`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <StatusIcon className={`${statusConfig.color} flex-shrink-0 mt-0.5`} size={32} />
            <div>
              <p className={`text-xl font-semibold ${statusConfig.textColor}`}>
                System is {statusConfig.label}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Version {data.version} • Environment: {data.environment}
              </p>
              {lastRefresh && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  Last checked: {lastRefresh.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Uptime</p>
            <p className="text-xl font-serif font-bold text-sage-700 dark:text-sage-400 mt-1">
              {formatUptime(data.uptime)}
            </p>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Services Health */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Server size={16} />
            Services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(data.services).map(([serviceName, service]) => {
              const isHealthy = service.status === 'ok';
              const config = isHealthy ? STATUS_CONFIG.ok : STATUS_CONFIG.error;
              const IconComponent = config.icon;

              return (
                <div
                  key={serviceName}
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                        {serviceName}
                      </h3>
                    </div>
                    <IconComponent className={config.color} size={18} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      {service.status}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {service.latencyMs}ms
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cron Status */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Clock size={16} />
            Cron Jobs
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 h-full">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Status
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      data.cron.enabled ? 'bg-sage-500' : 'bg-slate-300'
                    }`}
                  />
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {data.cron.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Scheduled Jobs
                </p>
                <p className="text-2xl font-serif font-bold text-slate-900 dark:text-white mt-2">
                  {data.cron.jobCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Memory Usage Card */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <BarChart3 size={16} />
          Memory Usage
        </h2>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Heap Used */}
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Heap Used
              </p>
              <p className="text-2xl font-serif font-bold text-slate-900 dark:text-white">
                {data.memory.heapUsed}
              </p>
            </div>

            {/* RSS */}
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Memory RSS
              </p>
              <p className="text-2xl font-serif font-bold text-slate-900 dark:text-white">
                {data.memory.rss}
              </p>
            </div>

            {/* Heap Total */}
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Heap Total
              </p>
              <p className="text-2xl font-serif font-bold text-slate-900 dark:text-white">
                {data.memory.heapTotal}
              </p>
            </div>
          </div>

          {/* Heap Usage Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Heap Utilization
              </p>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                {heapUsagePercent}%
              </p>
            </div>
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  heapUsagePercent >= 85
                    ? 'bg-red-500'
                    : heapUsagePercent >= 70
                      ? 'bg-amber-500'
                      : 'bg-sage-500'
                }`}
                style={{ width: `${heapUsagePercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Workers Section */}
      {data.workers.queuesRegistered.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Zap size={16} />
            Worker Queues
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
            <div className="flex flex-wrap gap-2">
              {data.workers.queuesRegistered.map((queue) => (
                <span
                  key={queue}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sage-50 dark:bg-sage-900/20 text-sage-700 dark:text-sage-300 text-xs font-medium rounded-lg border border-sage-200 dark:border-sage-800"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-sage-500" />
                  {queue}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-6 text-xs text-slate-400 dark:text-slate-500">
        Last updated: {new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  );
}

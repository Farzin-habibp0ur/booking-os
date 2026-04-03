'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Shield, Clock, MessageSquare, ShieldCheck } from 'lucide-react';

interface AIStats {
  processedToday: number;
  autoReplied: number;
  draftsCreated: number;
  failed: number;
  dailyLimit: number;
  history: unknown[];
}

interface AISettings {
  enabled: boolean;
  autoReply: {
    enabled: boolean;
    channelOverrides: Record<string, { enabled: boolean }>;
  };
}

const CHANNELS = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'SMS', 'EMAIL', 'WEB_CHAT'] as const;

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  SMS: 'SMS',
  EMAIL: 'Email',
  WEB_CHAT: 'Web Chat',
};

export function AIGuardrails() {
  const [stats, setStats] = useState<AIStats | null>(null);
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsData, settingsData] = await Promise.all([
          api.get<AIStats>('/ai/stats'),
          api.get<AISettings>('/ai/settings'),
        ]);
        setStats(statsData);
        setSettings(settingsData);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div
        data-testid="ai-guardrails"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-soft p-6"
      >
        <div className="space-y-3 animate-pulse">
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  const processedToday = stats?.processedToday ?? 0;
  const progressWidth = Math.min((processedToday / 500) * 100, 100);
  const channelOverrides = settings?.autoReply?.channelOverrides ?? {};

  return (
    <div
      data-testid="ai-guardrails"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-soft p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-slate-700 dark:text-slate-300" />
          <h2 className="font-serif text-lg font-semibold text-slate-900 dark:text-white">
            AI Guardrails
          </h2>
        </div>
        <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Active
        </span>
      </div>

      {/* Safety Indicators Grid */}
      <div className="space-y-4">
        {/* Daily Limit */}
        <div>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Daily limit:{' '}
            <span className="text-slate-900 dark:text-white">
              {processedToday} / 500 used today
            </span>
          </p>
          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-1.5 rounded-full bg-sage-500"
              style={{ width: `${progressWidth}%` }}
            />
          </div>
        </div>

        {/* Auto-reply window */}
        <div className="flex items-start gap-2">
          <Clock size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Replies only within 24h of last message
          </p>
        </div>

        {/* SMS protection */}
        <div className="flex items-start gap-2">
          <MessageSquare size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Auto-shortened to 160 characters
          </p>
        </div>

        {/* Booking safety */}
        <div className="flex items-start gap-2">
          <ShieldCheck size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Cancellations &amp; reschedules require confirmation
          </p>
        </div>

        {/* Channel status */}
        <div>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
            Auto-reply channels
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {CHANNELS.map((channel) => {
              const override = channelOverrides[channel];
              const enabled = override?.enabled !== false;
              return (
                <span key={channel} className="flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full inline-block ${enabled ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    {CHANNEL_LABELS[channel]}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer link */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
        <Link
          href="/ai/settings"
          className="text-xs text-sage-600 dark:text-sage-400 hover:text-sage-700 dark:hover:text-sage-300 transition-colors"
        >
          Adjust settings →
        </Link>
      </div>
    </div>
  );
}

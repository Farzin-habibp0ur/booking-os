'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Instagram, ExternalLink, Unplug, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface InstagramStatus {
  connected: boolean;
  pageName?: string;
  pageId?: string;
  tokenExpiresAt?: string;
}

interface InstagramConnectionProps {
  locationId: string;
}

export function InstagramConnection({ locationId }: InstagramConnectionProps) {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    loadStatus();
  }, [locationId]);

  async function loadStatus() {
    try {
      const data = await api.get<InstagramStatus>(
        `/instagram-auth/${locationId}/status`,
      );
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/instagram-auth/authorize?locationId=${locationId}`;
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await api.delete(`/instagram-auth/${locationId}/disconnect`);
      setStatus({ connected: false });
      setShowConfirm(false);
    } catch {
      // handled
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-40 bg-slate-200 rounded" />
          <div className="h-4 w-64 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  const tokenExpiring =
    status?.tokenExpiresAt &&
    new Date(status.tokenExpiresAt).getTime() - Date.now() < 10 * 24 * 60 * 60 * 1000;

  return (
    <div className="rounded-2xl border border-slate-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Instagram size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-medium text-slate-900">Instagram Direct Messages</h3>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full mt-1',
                status?.connected
                  ? tokenExpiring
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-sage-50 text-sage-700'
                  : 'bg-slate-100 text-slate-500',
              )}
            >
              {status?.connected && (
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    tokenExpiring ? 'bg-amber-500' : 'bg-sage-500',
                  )}
                />
              )}
              {status?.connected
                ? tokenExpiring
                  ? 'Token Expiring'
                  : 'Connected'
                : 'Not Connected'}
            </span>
          </div>
        </div>
      </div>

      {status?.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CheckCircle size={14} className="text-sage-500" />
            <span>
              Connected to <strong>{status.pageName}</strong>
            </span>
          </div>
          {tokenExpiring && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle size={14} />
              <span>
                Token expires{' '}
                {status.tokenExpiresAt &&
                  new Date(status.tokenExpiresAt).toLocaleDateString()}
                . It will auto-refresh.
              </span>
            </div>
          )}
          {showConfirm ? (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              >
                {disconnecting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Unplug size={14} />
                )}
                Confirm Disconnect
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="text-sm px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors mt-2"
            >
              <Unplug size={14} />
              Disconnect
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Connect your Instagram Professional account to receive and respond to DMs
            directly from your inbox.
          </p>
          <button
            onClick={handleConnect}
            className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-sage-600 text-white hover:bg-sage-700 transition-colors"
          >
            <ExternalLink size={14} />
            Connect Instagram
          </button>
        </div>
      )}
    </div>
  );
}

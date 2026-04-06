'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  ArrowLeft,
  Send,
  Repeat,
  StopCircle,
  Trophy,
  BarChart3,
  Copy,
  XCircle,
  Clock,
  Pencil,
  FlaskConical,
  Eye,
} from 'lucide-react';
import { useToast } from '@/lib/toast';
import { useI18n } from '@/lib/i18n';
import CampaignPreviewModal from '@/components/campaign-preview-modal';

function formatCountdown(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return 'Sending momentarily...';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  return parts.length > 0 ? `in ${parts.join(', ')}` : 'Sending momentarily...';
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SCHEDULED: 'bg-lavender-100 text-lavender-700',
  SENDING: 'bg-amber-100 text-amber-700',
  SENT: 'bg-sage-100 text-sage-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [variantStats, setVariantStats] = useState<any>(null);
  const [funnelStats, setFunnelStats] = useState<any>(null);
  const [channelStats, setChannelStats] = useState<any>(null);
  const [selectingWinner, setSelectingWinner] = useState(false);
  const [linkStats, setLinkStats] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();

  const handleClone = async () => {
    try {
      const cloned = await api.post<any>(`/campaigns/${id}/clone`);
      toast(t('campaigns.clone_success'));
      router.push(`/campaigns/${cloned.id}`);
    } catch {
      toast(t('campaigns.clone_error'), 'error');
    }
  };

  useEffect(() => {
    api
      .get<any>('/templates')
      .then((t) => setTemplates(Array.isArray(t) ? t : t.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get<any>(`/campaigns/${id}`)
      .then((c) => {
        setCampaign(c);
        if (c.isABTest) {
          api
            .get<any>(`/campaigns/${id}/variant-stats`)
            .then(setVariantStats)
            .catch(() => {});
        }
        if (c.status === 'SENT' || c.status === 'SENDING') {
          api
            .get<any>(`/campaigns/${id}/funnel`)
            .then(setFunnelStats)
            .catch(() => {});
          api
            .get<any>(`/campaigns/${id}/channel-stats`)
            .then(setChannelStats)
            .catch(() => {});
          api
            .get<any>(`/campaigns/${id}/link-stats`)
            .then((data) => setLinkStats(Array.isArray(data) ? data : []))
            .catch(() => {});
        }
      })
      .catch(() => router.push('/campaigns'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSend = async () => {
    try {
      await api.post(`/campaigns/${id}/send`);
      api.get<any>(`/campaigns/${id}`).then(setCampaign);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('campaigns.delete_confirm'))) return;
    await api.del(`/campaigns/${id}`);
    router.push('/campaigns');
  };

  const handleStopRecurrence = async () => {
    if (!confirm(t('campaigns.stop_recurrence_confirm'))) return;
    try {
      const updated = await api.post<any>(`/campaigns/${id}/stop-recurrence`);
      setCampaign(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async () => {
    if (!confirm(t('campaigns.cancel_confirm'))) return;
    try {
      await api.post(`/campaigns/${id}/cancel`);
      toast(t('campaigns.cancel_success'));
      const updated = await api.get<any>(`/campaigns/${id}`);
      setCampaign(updated);
    } catch {
      toast(t('campaigns.cancel_error'), 'error');
    }
  };

  const handleSelectWinner = async (variantId: string) => {
    setSelectingWinner(true);
    try {
      await api.post(`/campaigns/${id}/select-winner`, { variantId });
      const updated = await api.get<any>(`/campaigns/${id}`);
      setCampaign(updated);
      const stats = await api.get<any>(`/campaigns/${id}/variant-stats`);
      setVariantStats(stats);
    } catch (err) {
      console.error(err);
    } finally {
      setSelectingWinner(false);
    }
  };

  const getBestVariant = () => {
    if (!variantStats?.variants?.length) return null;
    return variantStats.variants.reduce(
      (best: any, v: any) => (v.bookings > (best?.bookings || 0) ? v : best),
      null,
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!campaign) return null;

  const stats = campaign.stats || {};

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => router.push('/campaigns')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft size={16} /> {t('campaigns.back')}
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-slate-900">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full inline-block',
                statusColors[campaign.status],
              )}
            >
              {campaign.status}
            </span>
            {campaign.recurrenceRule && campaign.recurrenceRule !== 'NONE' && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-lavender-50 text-lavender-700 text-xs rounded-full font-medium">
                <Repeat size={12} />
                {
                  (
                    {
                      DAILY: 'Daily',
                      WEEKLY: 'Weekly',
                      BIWEEKLY: 'Bi-weekly',
                      MONTHLY: 'Monthly',
                    } as Record<string, string>
                  )[campaign.recurrenceRule]
                }
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === 'DRAFT' && (
            <>
              <button
                onClick={handleSend}
                className="flex items-center gap-1.5 px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors"
              >
                <Send size={14} />
                {t('campaigns.send_now')}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-700 transition-colors"
              >
                {t('campaigns.delete')}
              </button>
            </>
          )}
          {(campaign.status === 'SENDING' || campaign.status === 'SCHEDULED') && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              <XCircle size={14} /> {t('campaigns.cancel_campaign')}
            </button>
          )}
          {campaign.status === 'SCHEDULED' && (
            <button
              onClick={() => router.push(`/campaigns/new?edit=${id}`)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Pencil size={14} /> {t('campaigns.edit')}
            </button>
          )}
          {(campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED') && (
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Eye size={14} /> Preview
            </button>
          )}
          <button
            onClick={handleClone}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Copy size={14} />
            {t('campaigns.clone')}
          </button>
          {campaign.recurrenceRule && campaign.recurrenceRule !== 'NONE' && (
            <button
              onClick={handleStopRecurrence}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-amber-700 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors"
            >
              <StopCircle size={14} />
              {t('campaigns.stop_recurrence')}
            </button>
          )}
        </div>
      </div>

      {/* Scheduled countdown banner */}
      {campaign.status === 'SCHEDULED' && campaign.scheduledAt && (
        <div
          data-testid="scheduled-banner"
          className="bg-lavender-50 border border-lavender-100 rounded-xl p-4 mb-6 flex items-center gap-3"
        >
          <Clock size={20} className="text-lavender-600" />
          <div>
            <span className="text-sm font-medium text-lavender-900">Scheduled</span>
            <span className="text-sm text-lavender-700 ml-2">
              Sends on{' '}
              {new Date(campaign.scheduledAt).toLocaleString('en-US', {
                dateStyle: 'full',
                timeStyle: 'short',
              })}{' '}
              ({formatCountdown(campaign.scheduledAt)})
            </span>
          </div>
        </div>
      )}

      {/* A/B Test phase banner */}
      {campaign.isABTest && campaign.testPhaseEndsAt && !campaign.winnerVariantId && (
        <div
          data-testid="test-phase-banner"
          className="bg-lavender-50 border border-lavender-100 rounded-xl p-4 mb-6 flex items-center gap-3"
        >
          <FlaskConical size={20} className="text-lavender-600" />
          <div>
            <span className="text-sm font-medium text-lavender-900">A/B Test in progress</span>
            <p className="text-sm text-lavender-700 mt-0.5">
              Testing {campaign.testAudiencePercent || 20}% of audience. Winner auto-selects{' '}
              {new Date(campaign.testPhaseEndsAt) > new Date()
                ? formatCountdown(campaign.testPhaseEndsAt)
                : 'momentarily'}
              {campaign.winnerMetric === 'BOOKING_RATE'
                ? ' based on booking rate'
                : ' based on read rate'}
              .
            </p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      {campaign.status === 'SENT' || campaign.status === 'SENDING' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: t('campaigns.detail.stat_sent'), value: stats.sent || 0 },
            { label: t('campaigns.detail.stat_delivered'), value: stats.delivered || 0 },
            { label: t('campaigns.detail.stat_read'), value: stats.read || 0 },
            { label: t('campaigns.detail.stat_bookings'), value: stats.bookings || 0 },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl shadow-soft p-4">
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="text-2xl font-serif font-bold text-slate-900">{stat.value}</p>
            </div>
          ))}
          {funnelStats?.revenueTotal != null && (
            <div className="bg-white rounded-2xl shadow-soft p-4">
              <p className="text-xs text-slate-500">{t('campaigns.detail.stat_revenue')}</p>
              <p className="text-2xl font-serif font-bold text-sage-600">
                ${funnelStats.revenueTotal.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* Conversion Funnel */}
      {funnelStats?.stages?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-soft p-5 mb-6" data-testid="campaign-funnel">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-sage-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              {t('campaigns.detail.conversion_funnel')}
            </h2>
          </div>
          <div className="space-y-3">
            {funnelStats.stages.map((stage: any, i: number) => {
              const maxCount = funnelStats.stages[0]?.count || 1;
              const widthPct = Math.max(8, (stage.count / maxCount) * 100);
              const prevStage = i > 0 ? funnelStats.stages[i - 1] : null;
              const dropOff =
                prevStage && prevStage.count > 0
                  ? Math.round(((prevStage.count - stage.count) / prevStage.count) * 100)
                  : 0;
              const colors = ['bg-sage-500', 'bg-sage-400', 'bg-sage-300', 'bg-lavender-500'];
              return (
                <div key={stage.label}>
                  {i > 0 && dropOff > 0 && (
                    <p className="text-xs text-slate-400 ml-2 mb-1">↓ {dropOff}% drop-off</p>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-16 text-right">{stage.label}</span>
                    <div className="flex-1 h-7 bg-slate-50 rounded-lg overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-lg flex items-center px-2 transition-all',
                          colors[i] || 'bg-sage-400',
                        )}
                        style={{ width: `${widthPct}%` }}
                      >
                        <span className="text-xs font-medium text-white">
                          {stage.count} ({stage.percentage}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Channel Breakdown */}
      {channelStats && typeof channelStats === 'object' && Object.keys(channelStats).length > 0 && (
        <div className="bg-white rounded-2xl shadow-soft p-5 mb-6" data-testid="channel-breakdown">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            {t('campaigns.detail.channel_breakdown')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left py-2 font-medium">Channel</th>
                  <th className="text-right py-2 font-medium">Sent</th>
                  <th className="text-right py-2 font-medium">Delivered</th>
                  <th className="text-right py-2 font-medium">Read</th>
                  <th className="text-right py-2 font-medium">Failed</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(channelStats).map(([ch, counts]: [string, any]) => {
                  if (!counts || typeof counts !== 'object') return null;
                  return (
                    <tr key={ch} className="border-b border-slate-50">
                      <td className="py-2 font-medium">{ch}</td>
                      <td className="py-2 text-right">{counts.sent || 0}</td>
                      <td className="py-2 text-right">{counts.delivered || 0}</td>
                      <td className="py-2 text-right">{counts.read || 0}</td>
                      <td className="py-2 text-right text-red-600">{counts.failed || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Link Performance */}
      {linkStats.length > 0 && (
        <div className="bg-white rounded-2xl shadow-soft p-5 mb-6" data-testid="link-performance">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            {t('campaigns.detail.link_performance')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left py-2 font-medium">{t('campaigns.detail.link_url')}</th>
                  <th className="text-right py-2 font-medium">
                    {t('campaigns.detail.link_clicks')}
                  </th>
                  <th className="text-right py-2 font-medium">
                    {t('campaigns.detail.link_unique')}
                  </th>
                  <th className="text-right py-2 font-medium">{t('campaigns.detail.link_ctr')}</th>
                </tr>
              </thead>
              <tbody>
                {linkStats.map((link: any) => (
                  <tr key={link.url} className="border-b border-slate-50">
                    <td className="py-2 font-medium text-sage-700 truncate max-w-[240px]">
                      {link.url}
                    </td>
                    <td className="py-2 text-right">{link.totalClicks}</td>
                    <td className="py-2 text-right">{link.uniqueClicks}</td>
                    <td className="py-2 text-right">{link.ctr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* A/B Test Results */}
      {campaign.isABTest && variantStats?.variants?.length > 0 && (
        <div className="mb-6" data-testid="ab-results">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            {t('campaigns.ab_test.results_title')}
          </h2>
          <div
            className={cn(
              'grid gap-4',
              variantStats.variants.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
            )}
          >
            {variantStats.variants.map((v: any) => {
              const best = getBestVariant();
              const isWinner = variantStats.winnerVariantId === v.variantId;
              const isBest = best?.variantId === v.variantId && !variantStats.winnerVariantId;
              return (
                <div
                  key={v.variantId}
                  className={cn(
                    'bg-white rounded-2xl shadow-soft p-4 relative',
                    isWinner && 'ring-2 ring-sage-400',
                  )}
                >
                  {isWinner && (
                    <div className="absolute -top-2 -right-2 bg-sage-50 text-sage-900 rounded-full p-1.5">
                      <Trophy size={14} />
                    </div>
                  )}
                  {isBest && (
                    <div
                      className="absolute -top-2 -right-2 bg-sage-50 text-sage-900 rounded-full p-1.5"
                      data-testid="best-badge"
                    >
                      <Trophy size={14} />
                    </div>
                  )}
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">{v.name}</h3>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Sent</dt>
                      <dd className="font-medium">{v.sent}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Delivered</dt>
                      <dd className="font-medium">{v.delivered}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Read</dt>
                      <dd className="font-medium">{v.read}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Bookings</dt>
                      <dd className="font-medium text-sage-700">{v.bookings}</dd>
                    </div>
                  </dl>
                  {!variantStats.winnerVariantId && campaign.status === 'SENT' && (
                    <button
                      onClick={() => handleSelectWinner(v.variantId)}
                      disabled={selectingWinner}
                      className="mt-3 w-full text-xs px-3 py-1.5 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors disabled:opacity-50"
                    >
                      {t('campaigns.ab_test.select_winner')}
                    </button>
                  )}
                  {isWinner && (
                    <p className="mt-2 text-xs text-sage-700 font-medium text-center">
                      {variantStats.autoWinnerSelected
                        ? t('campaigns.ab_test.auto_selected_winner')
                        : t('campaigns.ab_test.winner')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Campaign details */}
      <div className="bg-white rounded-2xl shadow-soft p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">
          {t('campaigns.detail.details')}
        </h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Created</dt>
            <dd>
              {new Date(campaign.createdAt).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </dd>
          </div>
          {campaign.scheduledAt && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Scheduled</dt>
              <dd>
                {new Date(campaign.scheduledAt).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </dd>
            </div>
          )}
          {campaign.sentAt && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Sent</dt>
              <dd>
                {new Date(campaign.sentAt).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-slate-500">Channel</dt>
            <dd>
              {(
                {
                  WHATSAPP: 'WhatsApp',
                  SMS: 'SMS',
                  EMAIL: 'Email',
                  MULTI: 'Multi-channel',
                } as Record<string, string>
              )[campaign.channel] ||
                campaign.channel ||
                'WhatsApp'}
            </dd>
          </div>
          {stats.sent !== undefined && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Audience</dt>
              <dd>{stats.sent} customers</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-slate-500">Throttle</dt>
            <dd>{campaign.throttlePerMinute} msg/min</dd>
          </div>
          {campaign.recurrenceRule && campaign.recurrenceRule !== 'NONE' && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Recurrence</dt>
              <dd>
                {
                  (
                    {
                      DAILY: 'Daily',
                      WEEKLY: 'Weekly',
                      BIWEEKLY: 'Bi-weekly',
                      MONTHLY: 'Monthly',
                    } as Record<string, string>
                  )[campaign.recurrenceRule]
                }
              </dd>
            </div>
          )}
          {campaign.nextRunAt && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Next Run</dt>
              <dd>
                {new Date(campaign.nextRunAt).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </dd>
            </div>
          )}
          {campaign.parentCampaignId && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Part of Series</dt>
              <dd>
                <button
                  onClick={() => router.push(`/campaigns/${campaign.parentCampaignId}`)}
                  className="text-sage-600 hover:text-sage-700 underline"
                >
                  View original
                </button>
              </dd>
            </div>
          )}
          {campaign.filters && Object.keys(campaign.filters).length > 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Filters</dt>
              <dd className="text-right">
                {campaign.filters.tags?.length > 0 && (
                  <span className="text-xs">Tags: {campaign.filters.tags.join(', ')}</span>
                )}
                {campaign.filters.noUpcomingBooking && (
                  <span className="text-xs block">No upcoming bookings</span>
                )}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Message section */}
      <div className="bg-white rounded-2xl shadow-soft p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">
          {t('campaigns.detail.message')}
        </h2>
        {campaign.isABTest && campaign.variants?.length > 0 ? (
          <div className="space-y-3">
            {campaign.variants.map((v: any, i: number) => (
              <div key={v.id} className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-600">{v.name}</span>
                  <span className="text-xs text-slate-400">({v.percentage}%)</span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{v.content}</p>
              </div>
            ))}
          </div>
        ) : campaign.templateId ? (
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm font-medium text-slate-600 mb-2">
              {templates.find((t: any) => t.id === campaign.templateId)?.name || 'Template'}
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {templates.find((t: any) => t.id === campaign.templateId)?.body || '—'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t('campaigns.message.no_message')}</p>
        )}
      </div>

      {/* Preview Modal */}
      <CampaignPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        content={campaign.variants?.length > 0 ? campaign.variants[0].content || '' : ''}
        channel={campaign.channel || 'WHATSAPP'}
        businessName="Your Business"
      />
    </div>
  );
}

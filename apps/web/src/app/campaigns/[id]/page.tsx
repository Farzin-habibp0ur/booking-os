'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ArrowLeft, Send } from 'lucide-react';

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
  const router = useRouter();

  useEffect(() => {
    api
      .get<any>(`/campaigns/${id}`)
      .then(setCampaign)
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
    if (!confirm('Delete this campaign?')) return;
    await api.del(`/campaigns/${id}`);
    router.push('/campaigns');
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
        <ArrowLeft size={16} /> Back to Campaigns
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-slate-900">{campaign.name}</h1>
          <span className={cn('text-xs px-2 py-0.5 rounded-full mt-1 inline-block', statusColors[campaign.status])}>
            {campaign.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === 'DRAFT' && (
            <>
              <button
                onClick={handleSend}
                className="flex items-center gap-1.5 px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors"
              >
                <Send size={14} />
                Send Now
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-700 transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats grid */}
      {campaign.status === 'SENT' || campaign.status === 'SENDING' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Sent', value: stats.sent || 0 },
            { label: 'Delivered', value: stats.delivered || 0 },
            { label: 'Read', value: stats.read || 0 },
            { label: 'Bookings', value: stats.bookings || 0 },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl shadow-soft p-4">
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="text-2xl font-serif font-bold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Campaign details */}
      <div className="bg-white rounded-2xl shadow-soft p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Details</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Created</dt>
            <dd>{new Date(campaign.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
          </div>
          {campaign.scheduledAt && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Scheduled</dt>
              <dd>{new Date(campaign.scheduledAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
            </div>
          )}
          {campaign.sentAt && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Sent</dt>
              <dd>{new Date(campaign.sentAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-slate-500">Throttle</dt>
            <dd>{campaign.throttlePerMinute} msg/min</dd>
          </div>
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
    </div>
  );
}

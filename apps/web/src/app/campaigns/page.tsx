'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Megaphone, Plus } from 'lucide-react';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';
import TooltipNudge from '@/components/tooltip-nudge';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SCHEDULED: 'bg-lavender-100 text-lavender-700',
  SENDING: 'bg-amber-100 text-amber-700',
  SENT: 'bg-sage-100 text-sage-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    api
      .get<any>('/campaigns?pageSize=50')
      .then(setCampaigns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <TooltipNudge
        id="campaigns-intro"
        title="Reach customers at scale"
        description="Create targeted campaigns to re-engage inactive customers, promote offers, or send seasonal messages. Filter by tags, booking history, and more."
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-serif font-semibold text-slate-900">Campaigns</h1>
        <button
          onClick={() => router.push('/campaigns/new')}
          className="flex items-center gap-2 px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors"
        >
          <Plus size={16} />
          New Campaign
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Scheduled</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Sent</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
                : campaigns.data.map((c: any) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => router.push(`/campaigns/${c.id}`)}
                    >
                      <td className="p-3 text-sm font-medium">{c.name}</td>
                      <td className="p-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', statusColors[c.status] || 'bg-slate-100')}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-slate-600">
                        {c.scheduledAt
                          ? new Date(c.scheduledAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                          : '—'}
                      </td>
                      <td className="p-3 text-sm text-slate-600">
                        {c.sentAt
                          ? new Date(c.sentAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                          : '—'}
                      </td>
                      <td className="p-3 text-sm text-slate-600">
                        {new Date(c.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && campaigns.data.length === 0 && (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Create your first campaign to re-engage customers and drive bookings."
          />
        )}
      </div>
    </div>
  );
}

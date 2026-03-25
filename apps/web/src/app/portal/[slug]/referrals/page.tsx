'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Gift, Copy, Check, Users, DollarSign, Share2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PageSkeleton } from '@/components/skeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function portalFetch(path: string) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('portal-token') : null;
  return fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => {
    if (r.status === 401) {
      sessionStorage.removeItem('portal-token');
      window.location.href = `/portal/${window.location.pathname.split('/')[2]}`;
      throw new Error('Unauthorized');
    }
    return r.json();
  });
}

interface ReferralInfo {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  creditsEarned: number;
  creditsRemaining: number;
  referrals: {
    id: string;
    referredName: string;
    status: string;
    creditAmount: number;
    createdAt: string;
    completedAt: string | null;
  }[];
}

export default function PortalReferralsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const customerId = sessionStorage.getItem('portal-customer-id');
    const businessId = sessionStorage.getItem('portal-business-id');
    if (!customerId || !businessId) return;

    portalFetch(`/portal/referral?customerId=${customerId}&businessId=${businessId}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = useCallback(async () => {
    if (!data?.referralLink) return;
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data?.referralLink]);

  const handleShare = useCallback(async () => {
    if (!data?.referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Referral Link',
          text: 'Book your appointment with my referral link!',
          url: data.referralLink,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  }, [data?.referralLink, handleCopy]);

  if (loading) return <PageSkeleton />;
  if (!data) {
    return (
      <div className="p-6 text-center text-slate-500">
        <Gift size={32} className="mx-auto mb-2 text-slate-300" />
        <p>Referral program is not available at this time.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6" data-testid="portal-referrals-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-50">
          <Gift size={20} className="text-sage-600" />
        </div>
        <div>
          <h1 className="text-xl font-serif font-semibold text-slate-900">Refer a Friend</h1>
          <p className="text-sm text-slate-500">
            Share your link. When they complete their first visit, you both earn credit.
          </p>
        </div>
      </div>

      {/* Referral Link */}
      <div className="bg-white rounded-2xl shadow-soft p-5">
        <p className="text-xs font-medium text-slate-500 mb-2">Your Referral Link</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 truncate font-mono">
            {data.referralLink}
          </div>
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors shrink-0',
              copied
                ? 'bg-sage-50 text-sage-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            onClick={handleShare}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-sage-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-sage-700 transition-colors"
          >
            <Share2 size={16} />
            Share with Friends
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl shadow-soft p-4 text-center">
          <Users size={16} className="mx-auto mb-1 text-slate-400" />
          <p className="text-2xl font-serif font-semibold text-slate-900">{data.totalReferrals}</p>
          <p className="text-xs text-slate-500">Referrals</p>
        </div>
        <div className="bg-white rounded-2xl shadow-soft p-4 text-center">
          <DollarSign size={16} className="mx-auto mb-1 text-sage-500" />
          <p className="text-2xl font-serif font-semibold text-sage-700">${data.creditsEarned}</p>
          <p className="text-xs text-slate-500">Earned</p>
        </div>
        <div className="bg-white rounded-2xl shadow-soft p-4 text-center">
          <DollarSign size={16} className="mx-auto mb-1 text-sage-500" />
          <p className="text-2xl font-serif font-semibold text-sage-700">
            ${data.creditsRemaining}
          </p>
          <p className="text-xs text-slate-500">Available</p>
        </div>
      </div>

      {/* Referral List */}
      {data.referrals.length > 0 && (
        <div className="bg-white rounded-2xl shadow-soft p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Your Referrals</h2>
          <div className="space-y-3">
            {data.referrals.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.referredName}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      r.status === 'COMPLETED'
                        ? 'bg-sage-50 text-sage-900'
                        : r.status === 'PENDING'
                          ? 'bg-lavender-50 text-lavender-900'
                          : 'bg-red-50 text-red-700',
                    )}
                  >
                    {r.status === 'COMPLETED'
                      ? 'Completed'
                      : r.status === 'PENDING'
                        ? 'Pending'
                        : 'Expired'}
                  </span>
                  {r.status === 'COMPLETED' && (
                    <span className="text-xs font-medium text-sage-700">+${r.creditAmount}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

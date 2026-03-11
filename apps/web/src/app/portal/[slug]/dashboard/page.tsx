'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  User,
  MessageSquare,
  Star,
  ChevronRight,
  X,
  ClipboardList,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { statusBadgeClasses } from '@/lib/design-tokens';
import { PageSkeleton } from '@/components/skeleton';
import { AftercarePortalView } from '@/components/aesthetic/aftercare-portal-view';

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

function portalPost(path: string, body: any) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('portal-token') : null;
  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then(async (r) => {
    if (r.status === 401) {
      sessionStorage.removeItem('portal-token');
      window.location.href = `/portal/${window.location.pathname.split('/')[2]}`;
      throw new Error('Unauthorized');
    }
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Request failed');
    return data;
  });
}

export default function PortalDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [cancelModal, setCancelModal] = useState<any>(null);
  const [rescheduleModal, setRescheduleModal] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [treatmentPlans, setTreatmentPlans] = useState<any[]>([]);
  const [acceptingPlan, setAcceptingPlan] = useState<string | null>(null);
  const [aftercareEnrollments, setAftercareEnrollments] = useState<any[]>([]);

  const loadData = useCallback(() => {
    return Promise.all([
      portalFetch('/portal/me'),
      portalFetch('/portal/upcoming'),
      portalFetch('/portal/bookings?page=1'),
      portalFetch('/portal/treatment-plans').catch(() => []),
      portalFetch('/portal/aftercare').catch(() => []),
    ])
      .then(([prof, up, bookings, plans, aftercare]) => {
        setProfile(prof);
        setUpcoming(up);
        setRecentBookings(bookings.data?.slice(0, 5) || []);
        setTreatmentPlans(Array.isArray(plans) ? plans : []);
        setAftercareEnrollments(Array.isArray(aftercare) ? aftercare : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem('portal-token');
    if (!token) {
      router.replace(`/portal/${slug}`);
      return;
    }

    loadData().finally(() => setLoading(false));
  }, [slug, router, loadData]);

  const handleCancel = async () => {
    if (!cancelModal) return;
    setActionLoading(true);
    setActionError('');
    try {
      await portalPost(`/portal/bookings/${cancelModal.id}/cancel`, {});
      setCancelModal(null);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleModal || !rescheduleDate) return;
    setActionLoading(true);
    setActionError('');
    try {
      await portalPost(`/portal/bookings/${rescheduleModal.id}/reschedule`, {
        newStartTime: new Date(rescheduleDate).toISOString(),
      });
      setRescheduleModal(null);
      setRescheduleDate('');
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reschedule');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold text-slate-900">
          Welcome back, {profile?.name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Member since{' '}
          {profile?.memberSince
            ? new Date(profile.memberSince).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })
            : '—'}
        </p>
      </div>

      {/* Upcoming bookings */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-lg font-serif font-semibold text-slate-900 mb-3">
            Upcoming Bookings
          </h2>
          <div className="space-y-3" data-testid="upcoming-bookings">
            {upcoming.slice(0, 3).map((b: any) => (
              <div key={b.id} className="bg-white rounded-2xl shadow-soft p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sage-50 rounded-xl flex items-center justify-center">
                      <Calendar size={18} className="text-sage-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{b.service?.name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <Clock size={12} />
                        {new Date(b.startTime).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(b.startTime).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {b.staff?.name && <span>with {b.staff.name}</span>}
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn('text-xs px-2 py-0.5 rounded-full', statusBadgeClasses(b.status))}
                  >
                    {b.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 ml-13">
                  <button
                    onClick={() => {
                      setCancelModal(b);
                      setActionError('');
                    }}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                    data-testid="dashboard-cancel-btn"
                  >
                    Cancel
                  </button>
                  {b.status === 'CONFIRMED' && (
                    <button
                      onClick={() => {
                        setRescheduleModal(b);
                        setRescheduleDate('');
                        setActionError('');
                      }}
                      className="text-xs text-sage-600 hover:text-sage-700 font-medium"
                      data-testid="dashboard-reschedule-btn"
                    >
                      Reschedule
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Treatment Plan Proposals */}
      {treatmentPlans.filter((p: any) => p.status === 'PROPOSED').length > 0 && (
        <section data-testid="treatment-plan-proposals">
          <h2 className="text-lg font-serif font-semibold text-slate-900 mb-3">
            Treatment Plans Awaiting Your Approval
          </h2>
          <div className="space-y-3">
            {treatmentPlans
              .filter((p: any) => p.status === 'PROPOSED')
              .map((plan: any) => (
                <div key={plan.id} className="bg-white rounded-2xl shadow-soft p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Treatment Plan</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {plan.sessions?.length || 0} session{plan.sessions?.length !== 1 ? 's' : ''}
                        {plan.totalEstimate && ` · $${Number(plan.totalEstimate).toFixed(2)}`}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-lavender-50 text-lavender-900">
                      Awaiting Approval
                    </span>
                  </div>
                  {plan.diagnosis && (
                    <p className="text-sm text-slate-600 mb-2 line-clamp-2">{plan.diagnosis}</p>
                  )}
                  {plan.sessions?.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {plan.sessions.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between text-xs text-slate-500">
                          <span>{s.sequenceOrder}. {s.service?.name}</span>
                          {s.service?.price > 0 && <span>${s.service.price}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setAcceptingPlan(plan.id);
                        try {
                          await portalPost(`/portal/treatment-plans/${plan.id}/accept`, {});
                          await loadData();
                        } catch {}
                        setAcceptingPlan(null);
                      }}
                      disabled={acceptingPlan === plan.id}
                      className="flex-1 px-3 py-2 text-sm bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors disabled:opacity-50"
                    >
                      {acceptingPlan === plan.id ? 'Accepting...' : 'Accept Plan'}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Active Aftercare */}
      {aftercareEnrollments.length > 0 && (
        <section data-testid="portal-aftercare">
          <h2 className="text-lg font-serif font-semibold text-slate-900 mb-3">
            Active Aftercare
          </h2>
          <AftercarePortalView enrollments={aftercareEnrollments} />
        </section>
      )}

      {/* Quick actions */}
      <section>
        <h2 className="text-lg font-serif font-semibold text-slate-900 mb-3">Quick Actions</h2>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          data-testid="quick-actions"
        >
          <button
            onClick={() => router.push(`/portal/${slug}/book`)}
            className="bg-white rounded-2xl shadow-soft p-4 text-left hover:bg-slate-50 transition-colors group"
          >
            <Calendar size={20} className="text-sage-600 mb-2" />
            <p className="text-sm font-medium text-slate-900">Book Again</p>
            <p className="text-xs text-slate-500 mt-0.5">Schedule a new appointment</p>
          </button>
          <button
            onClick={() => router.push(`/portal/${slug}/bookings`)}
            className="bg-white rounded-2xl shadow-soft p-4 text-left hover:bg-slate-50 transition-colors"
          >
            <Clock size={20} className="text-lavender-600 mb-2" />
            <p className="text-sm font-medium text-slate-900">My Bookings</p>
            <p className="text-xs text-slate-500 mt-0.5">View booking history</p>
          </button>
          <button
            onClick={() => router.push(`/portal/${slug}/intake`)}
            className="bg-white rounded-2xl shadow-soft p-4 text-left hover:bg-slate-50 transition-colors"
            data-testid="intake-form-action"
          >
            <ClipboardList
              size={20}
              className={
                profile?.preferences?.intakeComplete ? 'text-sage-600 mb-2' : 'text-amber-600 mb-2'
              }
            />
            <p className="text-sm font-medium text-slate-900">
              {profile?.preferences?.intakeComplete ? 'View Intake Form' : 'Complete Intake Form'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {profile?.preferences?.intakeComplete
                ? 'Review or update your info'
                : 'Required before your first visit'}
            </p>
          </button>
          <button
            onClick={() => router.push(`/portal/${slug}/profile`)}
            className="bg-white rounded-2xl shadow-soft p-4 text-left hover:bg-slate-50 transition-colors"
          >
            <User size={20} className="text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-900">My Profile</p>
            <p className="text-xs text-slate-500 mt-0.5">Update your details</p>
          </button>
        </div>
      </section>

      {/* Testimonial CTA */}
      <section>
        <div
          className="bg-lavender-50 border border-lavender-200 rounded-2xl p-5 flex items-center justify-between"
          data-testid="testimonial-cta"
        >
          <div className="flex items-center gap-3">
            <Star size={20} className="text-lavender-600" />
            <div>
              <p className="text-sm font-medium text-lavender-900">Share Your Experience</p>
              <p className="text-xs text-lavender-700 mt-0.5">
                Help others discover this business by leaving a testimonial.
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-lavender-400" />
        </div>
      </section>

      {/* Recent bookings */}
      {recentBookings.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-serif font-semibold text-slate-900">Recent Bookings</h2>
            <button
              onClick={() => router.push(`/portal/${slug}/bookings`)}
              className="text-xs text-sage-600 hover:text-sage-700"
            >
              View All
            </button>
          </div>
          <div
            className="bg-white rounded-2xl shadow-soft overflow-hidden divide-y"
            data-testid="recent-bookings"
          >
            {recentBookings.map((b: any) => (
              <div key={b.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{b.service?.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(b.startTime).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <span
                  className={cn('text-xs px-2 py-0.5 rounded-full', statusBadgeClasses(b.status))}
                >
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cancel modal */}
      {cancelModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          data-testid="cancel-modal"
        >
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif font-semibold text-slate-900">Cancel Booking</h3>
              <button
                onClick={() => setCancelModal(null)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              Are you sure you want to cancel your booking for{' '}
              <span className="font-medium">{cancelModal.service?.name}</span>?
            </p>
            <p className="text-xs text-slate-400 mb-4">
              {new Date(cancelModal.startTime).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}{' '}
              at{' '}
              {new Date(cancelModal.startTime).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
            {actionError && <p className="text-xs text-red-600 mb-3">{actionError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setCancelModal(null)}
                className="flex-1 px-4 py-2 text-sm border rounded-xl hover:bg-slate-50 transition-colors"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule modal */}
      {rescheduleModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          data-testid="reschedule-modal"
        >
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif font-semibold text-slate-900">
                Reschedule Booking
              </h3>
              <button
                onClick={() => setRescheduleModal(null)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              Select a new date and time for{' '}
              <span className="font-medium">{rescheduleModal.service?.name}</span>
            </p>
            <input
              type="datetime-local"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl mb-3"
            />
            {actionError && <p className="text-xs text-red-600 mb-3">{actionError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setRescheduleModal(null)}
                className="flex-1 px-4 py-2 text-sm border rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={actionLoading || !rescheduleDate}
                className="flex-1 px-4 py-2 text-sm bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Rescheduling...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

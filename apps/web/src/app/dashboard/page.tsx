'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageSkeleton } from '@/components/skeleton';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useMode } from '@/lib/use-mode';
import { KpiStrip } from './components/kpi-strip';
import { MyWork } from './components/my-work';
import { AttentionCards } from './components/attention-card';
import {
  Calendar,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  DollarSign,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  CircleDot,
  AlertTriangle,
  Check,
  Circle,
  X,
  Target,
  ClipboardList,
  Search,
  Star,
  Flag,
  Bookmark,
  Heart,
  Eye,
  Bell,
  Zap,
} from 'lucide-react';

const DASHBOARD_VIEW_ICONS: Record<string, any> = {
  filter: Search,
  star: Star,
  flag: Flag,
  bookmark: Bookmark,
  heart: Heart,
  eye: Eye,
  bell: Bell,
  zap: Zap,
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-lavender-50', text: 'text-lavender-900' },
  PENDING_DEPOSIT: { bg: 'bg-amber-50', text: 'text-amber-700' },
  CONFIRMED: { bg: 'bg-sage-50', text: 'text-sage-900' },
  IN_PROGRESS: { bg: 'bg-amber-50', text: 'text-amber-700' },
  COMPLETED: { bg: 'bg-sage-50', text: 'text-sage-900' },
  NO_SHOW: { bg: 'bg-red-50', text: 'text-red-700' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

const NUDGE_MESSAGES: Record<string, string> = {
  nudge_0: 'nudge_get_started',
  nudge_1: 'nudge_first_done',
  nudge_3: 'nudge_gaining_momentum',
  nudge_5: 'nudge_halfway_there',
  nudge_10: 'nudge_ten_complete',
};

const CHECKLIST_LABELS: Record<string, string> = {
  business_name: 'checklist_business_name',
  staff_added: 'checklist_staff_added',
  services_created: 'checklist_services_created',
  whatsapp_connected: 'checklist_whatsapp_connected',
  templates_ready: 'checklist_templates_ready',
  first_booking: 'checklist_first_booking',
  first_deposit: 'checklist_first_deposit',
  roi_baseline: 'checklist_roi_baseline',
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [dashboardViews, setDashboardViews] = useState<any[]>([]);
  const { t } = useI18n();
  const { user } = useAuth();
  const { mode, landingPath } = useMode();
  const isAdmin = user?.role === 'ADMIN';

  // Redirect non-dashboard modes to their landing page on initial login only.
  // Uses a session flag set by the login page to distinguish "just logged in"
  // from "explicitly navigated to /dashboard via sidebar".
  useEffect(() => {
    if (!user) return; // Wait for auth to load so mode/landingPath is accurate
    const justLoggedIn = sessionStorage.getItem('booking-os-login-redirect');
    if (!justLoggedIn) return; // Not a fresh login — don't redirect
    sessionStorage.removeItem('booking-os-login-redirect');
    if (landingPath && landingPath !== '/dashboard') {
      router.replace(landingPath);
    }
  }, [landingPath, router, user]);

  useEffect(() => {
    // Check if onboarding is complete; redirect to setup if not
    api
      .get<any>('/business')
      .then((biz) => {
        const config = biz.packConfig || {};
        if (!config.setupComplete) {
          router.push('/setup');
          return;
        }
        return api.get('/dashboard').then(setData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Load dashboard-pinned saved views
    api
      .get<any[]>('/saved-views/dashboard')
      .then((views) => setDashboardViews(views || []))
      .catch(() => {});
  }, []);

  const handleDismissNudge = async (nudgeId: string) => {
    try {
      await api.patch('/dashboard/dismiss-nudge', { nudgeId });
      setData((prev: any) => ({
        ...prev,
        milestoneProgress: {
          ...prev.milestoneProgress,
          currentNudge: null,
          dismissedNudges: [...(prev.milestoneProgress.dismissedNudges || []), nudgeId],
        },
      }));
    } catch {
      // Silently handle
    }
  };

  if (loading) return <PageSkeleton />;
  if (!data)
    return (
      <div className="p-6">
        <p className="text-red-500">{t('dashboard.failed_to_load')}</p>
      </div>
    );

  const m = data.metrics;
  const weekChange =
    m.totalBookingsLastWeek > 0
      ? Math.round(
          ((m.totalBookingsThisWeek - m.totalBookingsLastWeek) / m.totalBookingsLastWeek) * 100,
        )
      : m.totalBookingsThisWeek > 0
        ? 100
        : 0;

  const checklist = data.goLiveChecklist;
  const milestone = data.milestoneProgress;

  const handleResendVerification = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-verification');
    } catch {
      // Silently handle
    } finally {
      setResending(false);
    }
  };

  const isAgentOrProvider = mode === 'agent' || mode === 'provider';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-slate-900 dark:text-slate-100">
            {t('dashboard.title')}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* M16: Email verification banner */}
      {user && !user.emailVerified && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">Please verify your email address</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Check your inbox for a verification link or request a new one.
              </p>
            </div>
          </div>
          <button
            onClick={handleResendVerification}
            disabled={resending}
            className="text-xs font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50 shrink-0"
          >
            {resending ? 'Sending...' : 'Resend'}
          </button>
        </div>
      )}

      {/* KPI Strip — compact 3-item strip for agent/provider modes */}
      {isAgentOrProvider && (
        <KpiStrip
          mode={mode}
          metrics={m}
          myBookingsToday={data.myBookingsToday}
          completedTodayByStaff={data.completedTodayByStaff}
          myAssignedConversations={data.myAssignedConversations}
        />
      )}

      {/* Agent/Provider: My Work section (personal schedule + conversations) */}
      {isAgentOrProvider && (
        <MyWork
          myBookingsToday={data.myBookingsToday || []}
          myAssignedConversations={data.myAssignedConversations || []}
          completedTodayByStaff={data.completedTodayByStaff || 0}
        />
      )}

      {/* Attention Cards — all modes */}
      <AttentionCards attentionNeeded={data.attentionNeeded} />

      {/* Dashboard-pinned Saved Views */}
      {dashboardViews.length > 0 && (
        <div data-testid="dashboard-views" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {dashboardViews.map((view) => {
            const ViewIcon = DASHBOARD_VIEW_ICONS[view.icon] || Bookmark;
            return (
              <button
                key={view.id}
                onClick={() => router.push(`/${view.page}?viewId=${view.id}`)}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ViewIcon size={16} className="text-sage-600 mb-2" />
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                  {view.name}
                </p>
                <p className="text-xs text-slate-400 capitalize">{view.page}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Agent/Provider: Today's Schedule (if not already in My Work) */}
      {mode === 'agent' && (
        <TodaySchedule todayBookings={data.todayBookings} router={router} t={t} />
      )}

      {/* Admin mode: full dashboard sections */}
      {mode === 'admin' && (
        <>
          {/* Metric Cards */}
          <div
            data-tour-target="dashboard-metrics"
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <MetricCard
              icon={Calendar}
              color="blue"
              label={t('dashboard.bookings_this_week')}
              value={m.totalBookingsThisWeek}
              subtitle={
                weekChange !== 0
                  ? t('dashboard.vs_last_week', {
                      change: weekChange > 0 ? '+' + weekChange : weekChange,
                    })
                  : t('dashboard.same_as_last_week')
              }
              trend={weekChange > 0 ? 'up' : weekChange < 0 ? 'down' : 'flat'}
            />
            <MetricCard
              icon={DollarSign}
              color="green"
              label={t('dashboard.revenue_30d')}
              value={`$${m.revenueThisMonth.toLocaleString()}`}
            />
            <MetricCard
              icon={Users}
              color="purple"
              label={t('dashboard.total_customers', { entity: 'Customer' })}
              value={m.totalCustomers}
              subtitle={
                m.newCustomersThisWeek > 0
                  ? t('dashboard.this_week_count', { count: m.newCustomersThisWeek })
                  : undefined
              }
              trend={m.newCustomersThisWeek > 0 ? 'up' : 'flat'}
            />
            <MetricCard
              icon={MessageSquare}
              color="orange"
              label={t('dashboard.open_conversations')}
              value={m.openConversationCount}
              subtitle={t('dashboard.avg_response_detail', { minutes: m.avgResponseTimeMins })}
            />
          </div>

          {/* Waitlist Backfill */}
          {data.waitlistMetrics && data.waitlistMetrics.totalEntries > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList size={18} className="text-sage-600" />
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                    Waitlist Backfill
                  </h2>
                </div>
                <span className="text-xs text-slate-400">Last 30 days</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
                    {data.waitlistMetrics.totalEntries}
                  </p>
                  <p className="text-xs text-slate-500">Waitlisted</p>
                </div>
                <div>
                  <p className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
                    {data.waitlistMetrics.offers}
                  </p>
                  <p className="text-xs text-slate-500">Offered</p>
                </div>
                <div>
                  <p className="text-2xl font-serif font-bold text-sage-600">
                    {data.waitlistMetrics.claimed}
                  </p>
                  <p className="text-xs text-slate-500">Claimed</p>
                </div>
                <div>
                  <p className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
                    {data.waitlistMetrics.fillRate}%
                  </p>
                  <p className="text-xs text-slate-500">Fill Rate</p>
                </div>
              </div>
              {data.waitlistMetrics.avgTimeToFill > 0 && (
                <p className="text-xs text-slate-400 mt-3">
                  Avg. time to fill: {data.waitlistMetrics.avgTimeToFill} min
                </p>
              )}
            </div>
          )}

          {/* Secondary metrics row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{t('dashboard.no_show_rate')}</p>
                <AlertCircle
                  size={16}
                  className={m.noShowRate > 15 ? 'text-red-500' : 'text-sage-600'}
                />
              </div>
              <p className="text-2xl font-serif font-bold mt-1">{m.noShowRate}%</p>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div
                  className={cn(
                    'h-1.5 rounded-full',
                    m.noShowRate > 15
                      ? 'bg-red-400'
                      : m.noShowRate > 5
                        ? 'bg-amber-400'
                        : 'bg-sage-500',
                  )}
                  style={{ width: `${Math.min(m.noShowRate, 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
              <p className="text-sm text-slate-500">{t('dashboard.avg_response_time')}</p>
              <p className="text-2xl font-serif font-bold mt-1">
                {m.avgResponseTimeMins}
                <span className="text-sm font-sans font-normal text-slate-400">
                  {' '}
                  {t('dashboard.min_short')}
                </span>
              </p>
              <p
                className={cn(
                  'text-xs mt-1',
                  m.avgResponseTimeMins <= 5
                    ? 'text-sage-600'
                    : m.avgResponseTimeMins <= 15
                      ? 'text-amber-600'
                      : 'text-red-600',
                )}
              >
                {m.avgResponseTimeMins <= 5
                  ? t('dashboard.excellent')
                  : m.avgResponseTimeMins <= 15
                    ? t('dashboard.good')
                    : t('dashboard.needs_improvement')}
              </p>
            </div>

            {/* Consult -> Treatment Conversion */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Consult → Treatment</p>
              </div>
              <p className="text-2xl font-serif font-bold mt-1">
                {data.consultConversion?.rate ?? 0}%
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {data.consultConversion?.converted ?? 0} of{' '}
                {data.consultConversion?.consultCustomers ?? 0} consults converted
              </p>
            </div>

            {/* Status Breakdown */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
              <p className="text-sm text-slate-500 mb-2">{t('dashboard.this_week_by_status')}</p>
              <div className="space-y-1.5">
                {(data.statusBreakdown || []).map((s: any) => (
                  <div key={s.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          STATUS_COLORS[s.status]?.bg || 'bg-gray-300',
                        )}
                      />
                      <span className="text-xs text-slate-600">
                        {t(`status.${s.status.toLowerCase()}`)}
                      </span>
                    </div>
                    <span className="text-xs font-medium">{s.count}</span>
                  </div>
                ))}
                {(!data.statusBreakdown || data.statusBreakdown.length === 0) && (
                  <p className="text-xs text-slate-400">{t('dashboard.no_bookings_this_week')}</p>
                )}
              </div>
            </div>
          </div>

          {/* P1-20: Go-Live Checklist (ADMIN only, hidden when all complete) */}
          {isAdmin && checklist && !checklist.allComplete && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {t('dashboard.go_live_title')}
                </h2>
                <span className="text-xs text-slate-500">
                  {t('dashboard.go_live_progress', {
                    done: checklist.items.filter((i: any) => i.done).length,
                    total: checklist.items.length,
                  })}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                <div
                  className="h-2 rounded-full bg-sage-500 transition-all"
                  style={{
                    width: `${(checklist.items.filter((i: any) => i.done).length / checklist.items.length) * 100}%`,
                  }}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {checklist.items.map((item: any) => (
                  <div
                    key={item.key}
                    className={cn(
                      'flex items-center gap-2.5 p-3 rounded-xl',
                      item.done ? 'bg-sage-50/50' : 'bg-slate-50/60',
                    )}
                  >
                    {item.done ? (
                      <Check size={16} className="text-sage-600 shrink-0" />
                    ) : (
                      <Circle size={16} className="text-slate-300 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-xs', item.done ? 'text-sage-700' : 'text-slate-600')}>
                        {t(`dashboard.${CHECKLIST_LABELS[item.key]}`)}
                      </p>
                      {!item.done && (
                        <button
                          onClick={() => router.push(item.fixUrl)}
                          className="text-[10px] text-sage-600 hover:text-sage-700 flex items-center gap-0.5 mt-0.5 transition-colors"
                        >
                          {t('dashboard.fix')} <ArrowRight size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* P1-21: First 10 Bookings Milestone */}
          {milestone && (milestone.completedBookings < 10 || milestone.currentNudge) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target size={18} className="text-lavender-600" />
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                    {t('dashboard.milestone_title')}
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  {t('dashboard.milestone_progress', {
                    count: Math.min(milestone.completedBookings, 10),
                  })}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                <div
                  className="h-2 rounded-full bg-lavender-500 transition-all"
                  style={{
                    width: `${Math.min((milestone.completedBookings / 10) * 100, 100)}%`,
                  }}
                />
              </div>
              {milestone.currentNudge && (
                <div className="bg-lavender-50 border border-lavender-100 rounded-xl p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-lavender-900">
                      {t(`dashboard.${NUDGE_MESSAGES[milestone.currentNudge.id]}`)}
                    </p>
                    <button
                      onClick={() => router.push(milestone.currentNudge.link)}
                      className="text-xs text-lavender-600 hover:text-lavender-700 flex items-center gap-1 mt-2 transition-colors font-medium"
                    >
                      {t('dashboard.nudge_action')} <ArrowRight size={12} />
                    </button>
                  </div>
                  <button
                    onClick={() => handleDismissNudge(milestone.currentNudge.id)}
                    className="text-lavender-400 hover:text-lavender-600 transition-colors shrink-0 mt-0.5"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Today's Appointments + Unassigned */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Today's Appointments */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft">
              <div className="flex items-center justify-between p-6 pb-4">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {t('dashboard.todays_appointments')}
                </h2>
                <button
                  onClick={() => router.push('/calendar')}
                  className="text-xs text-sage-600 hover:text-sage-700 flex items-center gap-1 transition-colors"
                >
                  {t('dashboard.view_calendar')} <ArrowRight size={12} />
                </button>
              </div>
              <div className="px-6 pb-6">
                {data.todayBookings.length === 0 ? (
                  <div className="text-center py-6">
                    <Calendar size={24} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-400 text-sm">{t('dashboard.no_appointments_today')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.todayBookings.map((b: any) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[48px]">
                            <p className="text-sm font-semibold text-slate-900">
                              {new Date(b.startTime).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{b.customer?.name}</p>
                            <p className="text-xs text-slate-500">
                              {b.service?.name}
                              {b.service?.kind === 'CONSULT' && (
                                <span className="ml-1 text-[9px] bg-lavender-50 text-lavender-900 px-1 py-0 rounded-full">
                                  C
                                </span>
                              )}
                              {b.service?.kind === 'TREATMENT' && (
                                <span className="ml-1 text-[9px] bg-sage-50 text-sage-900 px-1 py-0 rounded-full">
                                  T
                                </span>
                              )}
                              {b.staff ? ` · ${b.staff.name}` : ''}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            STATUS_COLORS[b.status]?.bg,
                            STATUS_COLORS[b.status]?.text,
                          )}
                        >
                          {t(`status.${b.status.toLowerCase()}`)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Unassigned Conversations */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft">
              <div className="flex items-center justify-between p-6 pb-4">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {t('dashboard.unassigned_conversations')}
                </h2>
                <button
                  onClick={() => router.push('/inbox?filter=unassigned')}
                  className="text-xs text-sage-600 hover:text-sage-700 flex items-center gap-1 transition-colors"
                >
                  {t('dashboard.view_inbox')} <ArrowRight size={12} />
                </button>
              </div>
              <div className="px-6 pb-6">
                {data.unassignedConversations.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle2 size={24} className="mx-auto text-sage-300 mb-2" />
                    <p className="text-slate-400 text-sm">{t('dashboard.all_caught_up')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.unassignedConversations.map((c: any) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/inbox?conversationId=${c.id}`)}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">{c.customer?.name}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[220px]">
                            {c.messages?.[0]?.content || t('dashboard.no_messages')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] bg-lavender-50 text-lavender-900 px-2.5 py-0.5 rounded-full font-medium">
                            {t('dashboard.unassigned_badge')}
                          </span>
                          {c.lastMessageAt && (
                            <p className="text-[10px] text-slate-400 mt-1">
                              {timeAgo(new Date(c.lastMessageAt), t)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TodaySchedule({
  todayBookings,
  router,
  t,
}: {
  todayBookings: any[];
  router: ReturnType<typeof useRouter>;
  t: (key: string, params?: any) => string;
}) {
  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft"
      data-testid="today-schedule"
    >
      <div className="flex items-center justify-between p-6 pb-4">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">
          {t('dashboard.todays_appointments')}
        </h2>
        <button
          onClick={() => router.push('/calendar')}
          className="text-xs text-sage-600 hover:text-sage-700 flex items-center gap-1 transition-colors"
        >
          {t('dashboard.view_calendar')} <ArrowRight size={12} />
        </button>
      </div>
      <div className="px-6 pb-6">
        {todayBookings.length === 0 ? (
          <div className="text-center py-6">
            <Calendar size={24} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-400 text-sm">{t('dashboard.no_appointments_today')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayBookings.map((b: any) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[48px]">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {new Date(b.startTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {b.customer?.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {b.service?.name}
                      {b.staff ? ` · ${b.staff.name}` : ''}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-medium',
                    STATUS_COLORS[b.status]?.bg,
                    STATUS_COLORS[b.status]?.text,
                  )}
                >
                  {t(`status.${b.status.toLowerCase()}`)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  color,
  label,
  value,
  subtitle,
  trend,
}: {
  icon: any;
  color: string;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'flat';
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-sage-600 bg-sage-50',
    green: 'text-sage-700 bg-sage-50',
    purple: 'text-lavender-600 bg-lavender-50',
    orange: 'text-amber-600 bg-amber-50',
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft p-6">
      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-xl', colorMap[color])}>
          <Icon size={18} />
        </div>
        {trend === 'up' && <TrendingUp size={14} className="text-sage-500" />}
        {trend === 'down' && <TrendingDown size={14} className="text-red-400" />}
      </div>
      <p className="text-2xl font-serif font-bold mt-3 text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {subtitle && (
        <p
          className={cn(
            'text-[11px] mt-0.5',
            trend === 'up' ? 'text-sage-600' : trend === 'down' ? 'text-red-500' : 'text-slate-400',
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function timeAgo(date: Date, t: (key: string, params?: any) => string): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return t('dashboard.just_now');
  if (mins < 60) return t('dashboard.minutes_ago', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('dashboard.hours_ago', { count: hrs });
  return t('dashboard.days_ago', { count: Math.floor(hrs / 24) });
}

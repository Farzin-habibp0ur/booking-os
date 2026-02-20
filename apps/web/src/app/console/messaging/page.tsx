'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  MessageSquare,
  AlertCircle,
  CheckCircle,
  XCircle,
  Send,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface DashboardData {
  messagesSent: number;
  messagesDelivered: number;
  messagesFailed: number;
  deliveryRate: number;
  remindersSent: number;
  remindersFailed: number;
  reminderSuccessRate: number;
  activeConversations: number;
}

interface FailureReason {
  reason: string;
  count: number;
}

interface ImpactedTenant {
  businessId: string;
  businessName: string;
  failureCount: number;
  lastFailure: string;
}

interface FailuresData {
  topReasons: FailureReason[];
  impactedTenants: ImpactedTenant[];
}

interface WebhookHealth {
  isHealthy: boolean;
  recentInbound24h: number;
  recentOutbound24h: number;
  failedOutbound24h: number;
}

interface TenantStatusItem {
  businessId: string;
  businessName: string;
  hasWhatsappConfig: boolean;
  locationCount: number;
  configuredLocationCount: number;
  recentDeliveryRate: number;
  lastMessageAt: string | null;
}

interface ChecklistItem {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'error';
  description: string;
}

interface FixChecklist {
  businessName: string;
  items: ChecklistItem[];
}

type Tab = 'dashboard' | 'tenant-status';

export default function ConsoleMessagingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [failures, setFailures] = useState<FailuresData | null>(null);
  const [webhookHealth, setWebhookHealth] = useState<WebhookHealth | null>(null);
  const [tenantStatuses, setTenantStatuses] = useState<TenantStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<FixChecklist | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [dashData, failData, webhookData] = await Promise.all([
        api.get<DashboardData>('/admin/messaging-console/dashboard'),
        api.get<FailuresData>('/admin/messaging-console/failures'),
        api.get<WebhookHealth>('/admin/messaging-console/webhook-health'),
      ]);
      setDashboard(dashData);
      setFailures(failData);
      setWebhookHealth(webhookData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load messaging dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTenantStatuses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<TenantStatusItem[]>('/admin/messaging-console/tenant-status');
      setTenantStatuses(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load tenant statuses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboard();
    } else {
      fetchTenantStatuses();
    }
  }, [activeTab, fetchDashboard, fetchTenantStatuses]);

  const toggleTenantExpand = useCallback(
    async (businessId: string) => {
      if (expandedTenant === businessId) {
        setExpandedTenant(null);
        setChecklist(null);
        return;
      }

      setExpandedTenant(businessId);
      setChecklistLoading(true);
      try {
        const data = await api.get<FixChecklist>(
          `/admin/messaging-console/tenant/${businessId}/fix-checklist`,
        );
        setChecklist(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load fix checklist');
      } finally {
        setChecklistLoading(false);
      }
    },
    [expandedTenant],
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'tenant-status', label: 'Tenant Status' },
  ];

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-6xl" data-testid="messaging-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-40" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
        Messaging Ops
      </h1>

      {error && (
        <div
          className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 mb-6 text-red-700 dark:text-red-400"
          data-testid="messaging-error"
        >
          {error}
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl p-1"
        data-testid="messaging-tabs"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && dashboard && (
        <div data-testid="dashboard-tab">
          {/* KPI Strip */}
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
            data-testid="messaging-kpi-cards"
          >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
              <div className="flex items-center gap-2 mb-2">
                <Send size={14} className="text-sage-600" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">Sent (30d)</span>
              </div>
              <p
                className="text-2xl font-serif font-bold text-slate-900 dark:text-white"
                data-testid="messages-sent"
              >
                {dashboard.messagesSent}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={14} className="text-sage-600" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Delivery Rate
                </span>
              </div>
              <p
                className="text-2xl font-serif font-bold text-slate-900 dark:text-white"
                data-testid="delivery-rate"
              >
                {dashboard.deliveryRate}%
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={14} className="text-red-500" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">Failed</span>
              </div>
              <p
                className="text-2xl font-serif font-bold text-red-500"
                data-testid="messages-failed"
              >
                {dashboard.messagesFailed}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={14} className="text-sage-600" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Reminders Sent
                </span>
              </div>
              <p
                className="text-2xl font-serif font-bold text-slate-900 dark:text-white"
                data-testid="reminders-sent"
              >
                {dashboard.remindersSent}
              </p>
            </div>
          </div>

          {/* Webhook Health Banner */}
          {webhookHealth && (
            <div
              className={`rounded-2xl p-4 mb-6 flex items-center justify-between ${
                webhookHealth.isHealthy
                  ? 'bg-sage-50 dark:bg-sage-900/20'
                  : 'bg-amber-50 dark:bg-amber-900/20'
              }`}
              data-testid="webhook-health-banner"
            >
              <div className="flex items-center gap-3">
                <Activity
                  size={18}
                  className={webhookHealth.isHealthy ? 'text-sage-600' : 'text-amber-600'}
                />
                <div>
                  <p
                    className={`text-sm font-medium ${
                      webhookHealth.isHealthy
                        ? 'text-sage-800 dark:text-sage-300'
                        : 'text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    Webhook Status: {webhookHealth.isHealthy ? 'Healthy' : 'Degraded'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Inbound: {webhookHealth.recentInbound24h} | Outbound:{' '}
                    {webhookHealth.recentOutbound24h} | Failed: {webhookHealth.failedOutbound24h}{' '}
                    (24h)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Top Failure Reasons */}
          {failures && failures.topReasons.length > 0 && (
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
              data-testid="failure-reasons"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Top Failure Reasons
              </h2>
              <div className="space-y-3">
                {failures.topReasons.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle size={16} className="text-red-500 shrink-0" />
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {r.reason}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-red-500">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Impacted Tenants */}
          {failures && failures.impactedTenants.length > 0 && (
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6"
              data-testid="impacted-tenants"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Top Impacted Tenants
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="pb-3 pr-4">Business</th>
                      <th className="pb-3 pr-4">Failures</th>
                      <th className="pb-3">Last Failure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.impactedTenants.map((tenant) => (
                      <tr
                        key={tenant.businessId}
                        className="border-b border-slate-50 dark:border-slate-800/50"
                      >
                        <td className="py-3 pr-4">
                          <Link
                            href={`/console/businesses/${tenant.businessId}`}
                            className="text-sage-600 hover:text-sage-700 font-medium"
                          >
                            {tenant.businessName}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-red-500 font-medium">
                          {tenant.failureCount}
                        </td>
                        <td className="py-3 text-slate-500">
                          {new Date(tenant.lastFailure).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {dashboard.messagesSent === 0 && (
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-8 text-center"
              data-testid="empty-state"
            >
              <MessageSquare size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No messages sent in the last 30 days</p>
            </div>
          )}
        </div>
      )}

      {/* Tenant Status Tab */}
      {activeTab === 'tenant-status' && (
        <div data-testid="tenant-status-tab">
          {tenantStatuses.length === 0 ? (
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-8 text-center"
              data-testid="tenant-empty-state"
            >
              <MessageSquare size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No businesses found</p>
            </div>
          ) : (
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6"
              data-testid="tenant-status-table"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                WhatsApp Status by Tenant
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="pb-3 pr-4">Business</th>
                      <th className="pb-3 pr-4">WhatsApp</th>
                      <th className="pb-3 pr-4">Locations</th>
                      <th className="pb-3 pr-4">Delivery Rate</th>
                      <th className="pb-3 pr-4">Last Message</th>
                      <th className="pb-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantStatuses.map((tenant) => (
                      <React.Fragment key={tenant.businessId}>
                        <tr
                          className="border-b border-slate-50 dark:border-slate-800/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          onClick={() => toggleTenantExpand(tenant.businessId)}
                          data-testid={`tenant-row-${tenant.businessId}`}
                        >
                          <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">
                            {tenant.businessName}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                tenant.hasWhatsappConfig
                                  ? 'bg-sage-50 text-sage-700 dark:bg-sage-900/20 dark:text-sage-400'
                                  : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                              }`}
                              data-testid={`whatsapp-badge-${tenant.businessId}`}
                            >
                              {tenant.hasWhatsappConfig ? 'Connected' : 'Not configured'}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                            {tenant.configuredLocationCount}/{tenant.locationCount}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    tenant.recentDeliveryRate >= 80
                                      ? 'bg-sage-500'
                                      : tenant.recentDeliveryRate >= 50
                                        ? 'bg-amber-500'
                                        : 'bg-red-500'
                                  }`}
                                  style={{ width: `${tenant.recentDeliveryRate}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500">
                                {tenant.recentDeliveryRate}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-xs text-slate-500">
                            {tenant.lastMessageAt
                              ? new Date(tenant.lastMessageAt).toLocaleDateString()
                              : 'Never'}
                          </td>
                          <td className="py-3">
                            {expandedTenant === tenant.businessId ? (
                              <ChevronUp size={14} className="text-slate-400" />
                            ) : (
                              <ChevronDown size={14} className="text-slate-400" />
                            )}
                          </td>
                        </tr>
                        {expandedTenant === tenant.businessId && (
                          <tr key={`${tenant.businessId}-checklist`}>
                            <td colSpan={6} className="p-4 bg-slate-50 dark:bg-slate-800/50">
                              {checklistLoading ? (
                                <div className="animate-pulse space-y-2">
                                  {[...Array(4)].map((_, i) => (
                                    <div
                                      key={i}
                                      className="h-8 bg-slate-200 dark:bg-slate-700 rounded"
                                    />
                                  ))}
                                </div>
                              ) : checklist ? (
                                <div data-testid="fix-checklist">
                                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                    Fix Checklist — {checklist.businessName}
                                  </h3>
                                  <div className="space-y-2">
                                    {checklist.items.map((item) => (
                                      <div
                                        key={item.id}
                                        className="flex items-start gap-3 p-2 rounded-lg"
                                        data-testid={`checklist-item-${item.id}`}
                                      >
                                        {item.status === 'ok' && (
                                          <CheckCircle
                                            size={16}
                                            className="text-sage-600 shrink-0 mt-0.5"
                                          />
                                        )}
                                        {item.status === 'warning' && (
                                          <AlertCircle
                                            size={16}
                                            className="text-amber-600 shrink-0 mt-0.5"
                                          />
                                        )}
                                        {item.status === 'error' && (
                                          <XCircle
                                            size={16}
                                            className="text-red-500 shrink-0 mt-0.5"
                                          />
                                        )}
                                        <div>
                                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                                            {item.label}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            {item.description}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

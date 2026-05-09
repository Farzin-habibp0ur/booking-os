'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CalendarCheck, DollarSign, FileEdit, MessageSquare } from 'lucide-react';

interface FrontDeskSummary {
  leadsCaptured: number;
  approvedReplies: number;
  bookingsAttributed: number;
  estimatedRecoveredRevenue: number;
}

export function AIValueKPIs() {
  const [frontDesk, setFrontDesk] = useState<FrontDeskSummary>({
    leadsCaptured: 0,
    approvedReplies: 0,
    bookingsAttributed: 0,
    estimatedRecoveredRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const frontDeskData = await api.get<FrontDeskSummary>('/front-desk/summary?days=30');
        setFrontDesk(frontDeskData);
      } catch {
        // defaults already set to 0
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="ai-value-kpis">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse bg-white rounded-2xl h-24" />
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: 'Leads Captured',
      value: frontDesk.leadsCaptured,
      icon: <MessageSquare size={20} className="text-lavender-600" />,
      iconBg: 'bg-lavender-50',
    },
    {
      label: 'Drafts Approved',
      value: frontDesk.approvedReplies,
      icon: <FileEdit size={20} className="text-sage-600" />,
      iconBg: 'bg-sage-50',
    },
    {
      label: 'Bookings Attributed',
      value: frontDesk.bookingsAttributed,
      icon: <CalendarCheck size={20} className="text-slate-600" />,
      iconBg: 'bg-slate-100',
    },
    {
      label: 'Recovered Revenue',
      value: `$${frontDesk.estimatedRecoveredRevenue.toLocaleString()}`,
      icon: <DollarSign size={20} className="text-amber-700" />,
      iconBg: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="ai-value-kpis">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="bg-white rounded-2xl shadow-soft p-5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.iconBg} mb-3`}
          >
            {kpi.icon}
          </div>
          <p className="font-serif text-2xl font-bold text-slate-900">{kpi.value}</p>
          <p className="text-sm text-slate-500">{kpi.label}</p>
        </div>
      ))}
    </div>
  );
}

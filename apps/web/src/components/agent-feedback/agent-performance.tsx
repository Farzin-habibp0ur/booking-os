'use client';

interface AgentPerformanceProps {
  stats: {
    total: number;
    helpful: number;
    notHelpful: number;
    helpfulRate: number;
    byType: Record<string, { helpful: number; notHelpful: number; total: number }>;
  };
}

const TYPE_LABELS: Record<string, string> = {
  WAITLIST_MATCH: 'Waitlist Matching',
  RETENTION_DUE: 'Patient Retention',
  DUPLICATE_CUSTOMER: 'Duplicate Detection',
  SCHEDULE_GAP: 'Schedule Optimization',
  STALLED_QUOTE: 'Quote Follow-up',
  DEPOSIT_PENDING: 'Deposit Request',
  OVERDUE_REPLY: 'Overdue Reply',
  OPEN_SLOT: 'Open Slot',
};

export function AgentPerformance({ stats }: AgentPerformanceProps) {
  const typeEntries = Object.entries(stats.byType).sort(([, a], [, b]) => b.total - a.total);

  return (
    <div data-testid="agent-performance">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-soft p-4 text-center">
          <p className="text-2xl font-serif font-semibold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500 mt-1">Total Ratings</p>
        </div>
        <div className="bg-white rounded-2xl shadow-soft p-4 text-center">
          <p className="text-2xl font-serif font-semibold text-sage-600">{stats.helpfulRate}%</p>
          <p className="text-xs text-slate-500 mt-1">Helpful Rate</p>
        </div>
        <div className="bg-white rounded-2xl shadow-soft p-4 text-center">
          <p className="text-2xl font-serif font-semibold text-slate-900">
            {Object.keys(stats.byType).length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Agent Types</p>
        </div>
      </div>

      {/* Breakdown by type */}
      {typeEntries.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                  Agent Type
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Helpful</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                  Not Helpful
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Rate</th>
              </tr>
            </thead>
            <tbody>
              {typeEntries.map(([type, data]) => {
                const rate = data.total > 0 ? Math.round((data.helpful / data.total) * 100) : 0;
                return (
                  <tr key={type} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {TYPE_LABELS[type] || type}
                    </td>
                    <td className="px-4 py-3 text-right text-sage-600">{data.helpful}</td>
                    <td className="px-4 py-3 text-right text-red-500">{data.notHelpful}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          rate >= 70
                            ? 'bg-sage-50 text-sage-700'
                            : rate >= 40
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {rate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
          <p className="text-slate-400">No feedback data yet.</p>
        </div>
      )}
    </div>
  );
}

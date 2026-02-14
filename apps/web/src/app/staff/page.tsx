'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, ChevronDown, ChevronRight, Clock, CalendarOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StaffPage() {
  const { t } = useI18n();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [workingHours, setWorkingHours] = useState<Record<string, any[]>>({});
  const [timeOff, setTimeOff] = useState<Record<string, any[]>>({});
  const [tab, setTab] = useState<'hours' | 'timeoff'>('hours');
  const [saving, setSaving] = useState(false);

  // Time off form
  const [toStart, setToStart] = useState('');
  const [toEnd, setToEnd] = useState('');
  const [toReason, setToReason] = useState('');

  const load = () => api.get<any[]>('/staff').then(setStaffList);

  useEffect(() => { load(); }, []);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setTab('hours');
    if (!workingHours[id]) {
      const wh = await api.get<any[]>(`/staff/${id}/working-hours`);
      setWorkingHours((prev) => ({ ...prev, [id]: wh }));
    }
    if (!timeOff[id]) {
      const to = await api.get<any[]>(`/staff/${id}/time-off`);
      setTimeOff((prev) => ({ ...prev, [id]: to }));
    }
  };

  const updateHour = (staffId: string, dayOfWeek: number, field: string, value: any) => {
    setWorkingHours((prev) => ({
      ...prev,
      [staffId]: (prev[staffId] || []).map((h: any) =>
        h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h
      ),
    }));
  };

  const saveHours = async (staffId: string) => {
    setSaving(true);
    const hours = (workingHours[staffId] || []).map((h: any) => ({
      dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime, isOff: h.isOff,
    }));
    await api.patch(`/staff/${staffId}/working-hours`, { hours });
    setSaving(false);
  };

  const addTimeOff = async (staffId: string) => {
    if (!toStart || !toEnd) return;
    await api.post(`/staff/${staffId}/time-off`, {
      startDate: new Date(toStart).toISOString(),
      endDate: new Date(toEnd).toISOString(),
      reason: toReason || undefined,
    });
    const to = await api.get<any[]>(`/staff/${staffId}/time-off`);
    setTimeOff((prev) => ({ ...prev, [staffId]: to }));
    setToStart(''); setToEnd(''); setToReason('');
  };

  const removeTimeOff = async (staffId: string, toId: string) => {
    await api.del(`/staff/${staffId}/time-off/${toId}`);
    setTimeOff((prev) => ({
      ...prev,
      [staffId]: (prev[staffId] || []).filter((t: any) => t.id !== toId),
    }));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('staff.title')}</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700">
          <Plus size={16} /> {t('staff.add_button')}
        </button>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="w-8"></th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">{t('common.name')}</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">{t('common.email')}</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">{t('staff.role')}</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {staffList.map((s) => (
              <>
                <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(s.id)}>
                  <td className="pl-3">
                    {expandedId === s.id ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                  </td>
                  <td className="p-3 text-sm font-medium">{s.name}</td>
                  <td className="p-3 text-sm text-gray-600">{s.email}</td>
                  <td className="p-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full',
                      s.role === 'OWNER' ? 'bg-purple-100 text-purple-700' :
                      s.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                    )}>{s.role}</span>
                  </td>
                  <td className="p-3">
                    <span className={cn('text-xs', s.isActive ? 'text-green-600' : 'text-red-600')}>
                      {s.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                </tr>
                {expandedId === s.id && (
                  <tr key={`${s.id}-expanded`}>
                    <td colSpan={5} className="p-0">
                      <div className="bg-gray-50 border-t p-4">
                        {/* Tabs */}
                        <div className="flex gap-1 mb-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); setTab('hours'); }}
                            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm', tab === 'hours' ? 'bg-white border shadow-sm font-medium' : 'text-gray-500 hover:bg-white/50')}
                          >
                            <Clock size={14} /> {t('staff.working_hours')}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setTab('timeoff'); }}
                            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm', tab === 'timeoff' ? 'bg-white border shadow-sm font-medium' : 'text-gray-500 hover:bg-white/50')}
                          >
                            <CalendarOff size={14} /> {t('staff.time_off')}
                            {(timeOff[s.id]?.length || 0) > 0 && (
                              <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded-full">{timeOff[s.id].length}</span>
                            )}
                          </button>
                        </div>

                        {/* Working Hours Tab */}
                        {tab === 'hours' && (
                          <div>
                            <div className="bg-white border rounded-lg divide-y">
                              {(workingHours[s.id] || []).map((h: any) => (
                                <div key={h.dayOfWeek} className="flex items-center gap-3 px-4 py-2.5">
                                  <div className="w-24 text-sm font-medium">{t(`days.${DAYS[h.dayOfWeek].toLowerCase()}`)}</div>
                                  <label className="flex items-center gap-2 cursor-pointer min-w-[80px]">
                                    <input
                                      type="checkbox"
                                      checked={!h.isOff}
                                      onChange={() => updateHour(s.id, h.dayOfWeek, 'isOff', !h.isOff)}
                                      className="rounded"
                                    />
                                    <span className={cn('text-xs', h.isOff ? 'text-red-500' : 'text-green-600')}>{h.isOff ? t('common.off') : t('common.working')}</span>
                                  </label>
                                  {!h.isOff && (
                                    <>
                                      <input
                                        type="time"
                                        value={h.startTime}
                                        onChange={(e) => updateHour(s.id, h.dayOfWeek, 'startTime', e.target.value)}
                                        className="border rounded px-2 py-1 text-sm"
                                      />
                                      <span className="text-gray-400 text-sm">{t('common.to')}</span>
                                      <input
                                        type="time"
                                        value={h.endTime}
                                        onChange={(e) => updateHour(s.id, h.dayOfWeek, 'endTime', e.target.value)}
                                        className="border rounded px-2 py-1 text-sm"
                                      />
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 flex justify-end">
                              <button
                                onClick={() => saveHours(s.id)}
                                disabled={saving}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                              >
                                {saving ? t('common.saving') : t('staff.save_hours')}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Time Off Tab */}
                        {tab === 'timeoff' && (
                          <div>
                            {(timeOff[s.id] || []).length > 0 && (
                              <div className="bg-white border rounded-lg divide-y mb-3">
                                {(timeOff[s.id] || []).map((t: any) => (
                                  <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                                    <div>
                                      <p className="text-sm font-medium">
                                        {new Date(t.startDate).toLocaleDateString()} — {new Date(t.endDate).toLocaleDateString()}
                                      </p>
                                      {t.reason && <p className="text-xs text-gray-500">{t.reason}</p>}
                                    </div>
                                    <button onClick={() => removeTimeOff(s.id, t.id)} className="text-red-500 hover:text-red-700 p-1">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="bg-white border rounded-lg p-4 space-y-3">
                              <p className="text-sm font-medium">{t('staff.add_time_off')}</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs text-gray-500">{t('staff.start_date')}</label>
                                  <input type="date" value={toStart} onChange={(e) => setToStart(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500">{t('staff.end_date')}</label>
                                  <input type="date" value={toEnd} onChange={(e) => setToEnd(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
                                </div>
                              </div>
                              <input value={toReason} onChange={(e) => setToReason(e.target.value)} placeholder={t('staff.reason_placeholder')} className="w-full border rounded px-3 py-2 text-sm" />
                              <button
                                onClick={() => addTimeOff(s.id)}
                                disabled={!toStart || !toEnd}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                              >
                                {t('staff.add_time_off')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <StaffForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function StaffForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('AGENT');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/staff', { name, email, password, role });
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">{t('staff.add_title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('staff.name_placeholder')} required className="w-full border rounded px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('staff.email_placeholder')} type="email" required className="w-full border rounded px-3 py-2 text-sm" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('staff.password_placeholder')} type="password" required className="w-full border rounded px-3 py-2 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
            <option value="AGENT">{t('staff.role_agent')}</option>
            <option value="ADMIN">{t('staff.role_admin')}</option>
            <option value="OWNER">{t('staff.role_owner')}</option>
          </select>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-sm">{t('common.cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm">{t('common.create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

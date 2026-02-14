'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import { Check, ChevronLeft, ChevronRight, Building2, MessageCircle, Users, Scissors, Clock, FileText, Rocket, Plus, X, Trash2 } from 'lucide-react';

const STEP_KEYS = ['business', 'whatsapp', 'staff', 'services', 'hours', 'templates', 'finish'] as const;

const STEP_ICONS = [Building2, MessageCircle, Users, Scissors, Clock, FileText, Rocket];

const DAYS_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export default function SetupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);

  // Business info
  const [bizName, setBizName] = useState('');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [currency, setCurrency] = useState('USD');

  // Staff
  const [staffList, setStaffList] = useState<any[]>([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('AGENT');

  // Services
  const [services, setServices] = useState<any[]>([]);
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcDuration, setNewSvcDuration] = useState(30);
  const [newSvcPrice, setNewSvcPrice] = useState(0);

  // Working hours
  const [staffHours, setStaffHours] = useState<Record<string, any[]>>({});
  const [selectedStaffForHours, setSelectedStaffForHours] = useState('');

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [biz, staffRes, svcRes, tplRes] = await Promise.all([
        api.get<any>('/business'),
        api.get<any[]>('/staff'),
        api.get<any>('/services'),
        api.get<any[]>('/templates'),
      ]);
      setBizName(biz.name || '');
      setTimezone(biz.timezone || 'America/Los_Angeles');
      setStaffList(staffRes || []);
      setServices(svcRes?.data || svcRes || []);
      setTemplates(tplRes || []);
      if (staffRes?.length > 0) {
        setSelectedStaffForHours(staffRes[0].id);
        await loadWorkingHours(staffRes[0].id);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadWorkingHours = async (staffId: string) => {
    try {
      const wh = await api.get<any[]>(`/staff/${staffId}/working-hours`);
      setStaffHours((prev) => ({ ...prev, [staffId]: wh }));
    } catch (e) { console.error(e); }
  };

  // Step handlers
  const saveBusiness = async () => {
    await api.patch('/business', { name: bizName, timezone });
  };

  const addStaff = async () => {
    if (!newStaffName || !newStaffEmail) return;
    const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    await api.post('/staff', { name: newStaffName, email: newStaffEmail, password: tempPassword, role: newStaffRole });
    alert(`Staff member created. Temporary password: ${tempPassword}\nPlease share it securely and ask them to change it.`);
    setNewStaffName(''); setNewStaffEmail(''); setNewStaffRole('AGENT');
    const updated = await api.get<any[]>('/staff');
    setStaffList(updated);
  };

  const addService = async () => {
    if (!newSvcName) return;
    await api.post('/services', { name: newSvcName, durationMins: Number(newSvcDuration), price: Number(newSvcPrice), category: 'General' });
    setNewSvcName(''); setNewSvcDuration(30); setNewSvcPrice(0);
    const updated = await api.get<any>('/services');
    setServices(updated?.data || updated || []);
  };

  const updateHourForDay = async (staffId: string, dayOfWeek: number, field: string, value: any) => {
    const current = staffHours[staffId] || [];
    const day = current.find((h: any) => h.dayOfWeek === dayOfWeek);
    if (!day) return;
    const updated = { ...day, [field]: value };
    const allHours = current.map((h: any) => h.dayOfWeek === dayOfWeek ? updated : h);
    setStaffHours((prev) => ({ ...prev, [staffId]: allHours }));
  };

  const saveWorkingHours = async (staffId: string) => {
    const hours = (staffHours[staffId] || []).map((h: any) => ({
      dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime, isOff: h.isOff,
    }));
    await api.patch(`/staff/${staffId}/working-hours`, { hours });
  };

  const handleNext = async () => {
    if (step === 0) await saveBusiness();
    if (step === 4 && selectedStaffForHours) await saveWorkingHours(selectedStaffForHours);
    if (step < STEP_KEYS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><p className="text-gray-400">{t('common.loading')}</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Progress bar */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold">{t('setup.title')}</h1>
            <span className="text-sm text-gray-500">{t('setup.step_label', { current: step + 1, total: STEP_KEYS.length })}</span>
          </div>
          <div className="flex gap-1">
            {STEP_KEYS.map((s, i) => (
              <button
                key={s}
                onClick={() => setStep(i)}
                className={cn(
                  'flex-1 h-2 rounded-full transition-colors',
                  i < step ? 'bg-green-500' : i === step ? 'bg-blue-600' : 'bg-gray-200',
                )}
              />
            ))}
          </div>
          <div className="flex mt-2">
            {STEP_KEYS.map((s, i) => (
              <button
                key={s}
                onClick={() => setStep(i)}
                className={cn(
                  'flex-1 text-center text-[10px] transition-colors',
                  i <= step ? 'text-gray-700 font-medium' : 'text-gray-400',
                )}
              >
                {t(`setup.steps.${s}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Step 1: Business Info */}
        {step === 0 && (
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">{t('setup.business_title')}</h2>
            <p className="text-sm text-gray-500">{t('setup.business_subtitle')}</p>
            <div>
              <label className="block text-sm font-medium mb-1">{t('setup.business_name_label')}</label>
              <input value={bizName} onChange={(e) => setBizName(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder={t('setup.business_name_placeholder')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('setup.timezone_label')}</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Singapore', 'Australia/Sydney', 'UTC'].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('setup.currency_label')}</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                {['USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Connect WhatsApp */}
        {step === 1 && (
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">{t('setup.whatsapp_title')}</h2>
            <p className="text-sm text-gray-500">{t('setup.whatsapp_subtitle')}</p>
            <div className="border rounded-lg p-4 bg-green-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <MessageCircle size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t('setup.whatsapp_api')}</p>
                  <p className="text-xs text-gray-500">{t('setup.whatsapp_api_desc')}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700">
                  {t('setup.connect_whatsapp')}
                </button>
                <button onClick={handleNext} className="border px-4 py-2 rounded-md text-sm hover:bg-gray-50">
                  {t('setup.skip_for_now')}
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              {t('setup.whatsapp_note')}
            </div>
          </div>
        )}

        {/* Step 3: Add Staff */}
        {step === 2 && (
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">{t('setup.staff_title')}</h2>
            <p className="text-sm text-gray-500">{t('setup.staff_subtitle')}</p>

            {staffList.length > 0 && (
              <div className="border rounded-lg divide-y">
                {staffList.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.email}</p>
                    </div>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{s.role}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">{t('setup.add_another_staff')}</p>
              <div className="grid grid-cols-2 gap-3">
                <input value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder={t('common.name')} className="border rounded-md px-3 py-2 text-sm" />
                <input value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} placeholder={t('common.email')} type="email" className="border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3">
                <select value={newStaffRole} onChange={(e) => setNewStaffRole(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
                  <option value="AGENT">{t('setup.role_agent')}</option>
                  <option value="ADMIN">{t('setup.role_admin')}</option>
                  <option value="OWNER">{t('setup.role_owner')}</option>
                </select>
                <button onClick={addStaff} disabled={!newStaffName || !newStaffEmail} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                  <Plus size={14} className="inline mr-1" /> {t('common.add')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Define Services */}
        {step === 3 && (
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">{t('setup.services_title')}</h2>
            <p className="text-sm text-gray-500">{t('setup.services_subtitle')}</p>

            {services.length > 0 && (
              <div className="border rounded-lg divide-y">
                {services.filter((s: any) => s.isActive !== false).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.durationMins} {t('services.min_short')} · {s.price > 0 ? `$${s.price}` : t('services.price_free')}</p>
                    </div>
                    <span className="text-xs text-gray-400">{s.category}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">{t('setup.add_service')}</p>
              <input value={newSvcName} onChange={(e) => setNewSvcName(e.target.value)} placeholder={t('setup.service_name_placeholder')} className="w-full border rounded-md px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">{t('setup.duration_label')}</label>
                  <input value={newSvcDuration} onChange={(e) => setNewSvcDuration(Number(e.target.value))} type="number" className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('setup.price_label')}</label>
                  <input value={newSvcPrice} onChange={(e) => setNewSvcPrice(Number(e.target.value))} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
              <button onClick={addService} disabled={!newSvcName} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                <Plus size={14} className="inline mr-1" /> {t('setup.add_service_button')}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Working Hours */}
        {step === 4 && (
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">{t('setup.hours_title')}</h2>
            <p className="text-sm text-gray-500">{t('setup.hours_subtitle')}</p>

            {staffList.length > 1 && (
              <div className="flex gap-2">
                {staffList.map((s) => (
                  <button
                    key={s.id}
                    onClick={async () => {
                      setSelectedStaffForHours(s.id);
                      if (!staffHours[s.id]) await loadWorkingHours(s.id);
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm',
                      selectedStaffForHours === s.id ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200',
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            <div className="border rounded-lg divide-y">
              {(staffHours[selectedStaffForHours] || []).map((h: any) => (
                <div key={h.dayOfWeek} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-24 text-sm font-medium">{t(`days.${DAYS_KEYS[h.dayOfWeek]}`)}</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!h.isOff}
                      onChange={(e) => updateHourForDay(selectedStaffForHours, h.dayOfWeek, 'isOff', !e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-xs text-gray-500">{h.isOff ? t('common.off') : t('common.working')}</span>
                  </label>
                  {!h.isOff && (
                    <>
                      <input
                        type="time"
                        value={h.startTime}
                        onChange={(e) => updateHourForDay(selectedStaffForHours, h.dayOfWeek, 'startTime', e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      />
                      <span className="text-gray-400">{t('common.to')}</span>
                      <input
                        type="time"
                        value={h.endTime}
                        onChange={(e) => updateHourForDay(selectedStaffForHours, h.dayOfWeek, 'endTime', e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 6: Templates */}
        {step === 5 && (
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">{t('setup.templates_title')}</h2>
            <p className="text-sm text-gray-500">{t('setup.templates_subtitle')}</p>

            <div className="space-y-3">
              {templates.map((tpl) => (
                <div key={tpl.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{tpl.name}</p>
                      <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">{tpl.category}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded p-2">{tpl.body}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tpl.variables?.map((v: string) => (
                      <span key={v} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{`{{${v}}}`}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400">{t('setup.templates_note')}</p>
          </div>
        )}

        {/* Step 7: Test & Finish */}
        {step === 6 && (
          <div className="bg-white rounded-lg border p-6 space-y-6">
            <h2 className="text-lg font-semibold">{t('setup.finish_title')}</h2>
            <p className="text-sm text-gray-500">{t('setup.finish_subtitle')}</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <p className="text-2xl font-bold text-blue-600">{staffList.length}</p>
                <p className="text-sm text-gray-500">{t('setup.staff_members')}</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-2xl font-bold text-blue-600">{services.filter((s: any) => s.isActive !== false).length}</p>
                <p className="text-sm text-gray-500">{t('setup.services_count')}</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-2xl font-bold text-blue-600">{templates.length}</p>
                <p className="text-sm text-gray-500">{t('setup.templates_count')}</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-2xl font-bold text-green-600">{t('setup.ready')}</p>
                <p className="text-sm text-gray-500">{t('setup.simulator_label')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => window.open('http://localhost:3002', '_blank')}
                className="w-full border rounded-md py-2.5 text-sm hover:bg-gray-50"
              >
                {t('setup.open_simulator')}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-blue-600 text-white rounded-md py-2.5 text-sm hover:bg-blue-700 font-medium"
              >
                {t('setup.go_to_dashboard')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-2xl mx-auto px-6 py-3 flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2 border rounded-md text-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} /> {t('common.back')}
          </button>
          {step < STEP_KEYS.length - 1 ? (
            <button onClick={handleNext} className="flex items-center gap-1 bg-blue-600 text-white px-6 py-2 rounded-md text-sm hover:bg-blue-700">
              {t('common.next')} <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1 bg-green-600 text-white px-6 py-2 rounded-md text-sm hover:bg-green-700">
              <Check size={16} /> {t('setup.finish_setup')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

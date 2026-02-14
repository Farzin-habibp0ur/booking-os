'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Check, ChevronLeft, ChevronRight, Building2, MessageCircle, Users, Scissors, Clock, FileText, Rocket, Plus, X, Trash2 } from 'lucide-react';

const STEPS = [
  { key: 'business', label: 'Business Info', icon: Building2 },
  { key: 'whatsapp', label: 'Connect WhatsApp', icon: MessageCircle },
  { key: 'staff', label: 'Add Staff', icon: Users },
  { key: 'services', label: 'Define Services', icon: Scissors },
  { key: 'hours', label: 'Working Hours', icon: Clock },
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'finish', label: 'Test & Finish', icon: Rocket },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SetupPage() {
  const router = useRouter();
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
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><p className="text-gray-400">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Progress bar */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold">Setup your Booking OS</h1>
            <span className="text-sm text-gray-500">Step {step + 1} of {STEPS.length}</span>
          </div>
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                onClick={() => setStep(i)}
                className={cn(
                  'flex-1 h-2 rounded-full transition-colors',
                  i < step ? 'bg-green-500' : i === step ? 'bg-blue-600' : 'bg-gray-200',
                )}
              />
            ))}
          </div>
          <div className="flex mt-2">
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                onClick={() => setStep(i)}
                className={cn(
                  'flex-1 text-center text-[10px] transition-colors',
                  i <= step ? 'text-gray-700 font-medium' : 'text-gray-400',
                )}
              >
                {s.label}
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
            <h2 className="text-lg font-semibold">Business Information</h2>
            <p className="text-sm text-gray-500">Tell us about your business</p>
            <div>
              <label className="block text-sm font-medium mb-1">Business Name *</label>
              <input value={bizName} onChange={(e) => setBizName(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. Glow Aesthetic Clinic" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Timezone *</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Singapore', 'Australia/Sydney', 'UTC'].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
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
            <h2 className="text-lg font-semibold">Connect WhatsApp</h2>
            <p className="text-sm text-gray-500">Connect your WhatsApp Business account to receive messages</p>
            <div className="border rounded-lg p-4 bg-green-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <MessageCircle size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm">WhatsApp Business API</p>
                  <p className="text-xs text-gray-500">Connect via Meta Business Suite or Cloud API</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700">
                  Connect WhatsApp
                </button>
                <button onClick={handleNext} className="border px-4 py-2 rounded-md text-sm hover:bg-gray-50">
                  Skip for now (use simulator)
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              You can always connect later from Settings. The WhatsApp Simulator is available for testing.
            </div>
          </div>
        )}

        {/* Step 3: Add Staff */}
        {step === 2 && (
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Add Staff / Providers</h2>
            <p className="text-sm text-gray-500">Add the people who will handle bookings and messages</p>

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
              <p className="text-sm font-medium">Add another staff member</p>
              <div className="grid grid-cols-2 gap-3">
                <input value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder="Name" className="border rounded-md px-3 py-2 text-sm" />
                <input value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} placeholder="Email" type="email" className="border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3">
                <select value={newStaffRole} onChange={(e) => setNewStaffRole(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
                  <option value="AGENT">Agent (Front Desk)</option>
                  <option value="ADMIN">Admin</option>
                  <option value="OWNER">Owner</option>
                </select>
                <button onClick={addStaff} disabled={!newStaffName || !newStaffEmail} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                  <Plus size={14} className="inline mr-1" /> Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Define Services */}
        {step === 3 && (
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Define Services</h2>
            <p className="text-sm text-gray-500">What services does your business offer?</p>

            {services.length > 0 && (
              <div className="border rounded-lg divide-y">
                {services.filter((s: any) => s.isActive !== false).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.durationMins} min · {s.price > 0 ? `$${s.price}` : 'Free'}</p>
                    </div>
                    <span className="text-xs text-gray-400">{s.category}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">Add a service</p>
              <input value={newSvcName} onChange={(e) => setNewSvcName(e.target.value)} placeholder="Service name (e.g. Botox, Consultation)" className="w-full border rounded-md px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Duration (minutes)</label>
                  <input value={newSvcDuration} onChange={(e) => setNewSvcDuration(Number(e.target.value))} type="number" className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Price ($)</label>
                  <input value={newSvcPrice} onChange={(e) => setNewSvcPrice(Number(e.target.value))} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
              <button onClick={addService} disabled={!newSvcName} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                <Plus size={14} className="inline mr-1" /> Add Service
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Working Hours */}
        {step === 4 && (
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Working Hours</h2>
            <p className="text-sm text-gray-500">Set when each staff member is available</p>

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
                  <div className="w-24 text-sm font-medium">{DAYS[h.dayOfWeek]}</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!h.isOff}
                      onChange={(e) => updateHourForDay(selectedStaffForHours, h.dayOfWeek, 'isOff', !e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-xs text-gray-500">{h.isOff ? 'Off' : 'Working'}</span>
                  </label>
                  {!h.isOff && (
                    <>
                      <input
                        type="time"
                        value={h.startTime}
                        onChange={(e) => updateHourForDay(selectedStaffForHours, h.dayOfWeek, 'startTime', e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      />
                      <span className="text-gray-400">to</span>
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
            <h2 className="text-lg font-semibold">Message Templates</h2>
            <p className="text-sm text-gray-500">Pre-built templates for confirmations and reminders. You can edit these anytime.</p>

            <div className="space-y-3">
              {templates.map((t) => (
                <div key={t.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{t.name}</p>
                      <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">{t.category}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded p-2">{t.body}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.variables?.map((v: string) => (
                      <span key={v} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{`{{${v}}}`}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400">You can create and edit templates from Settings after setup is complete.</p>
          </div>
        )}

        {/* Step 7: Test & Finish */}
        {step === 6 && (
          <div className="bg-white rounded-lg border p-6 space-y-6">
            <h2 className="text-lg font-semibold">You're all set!</h2>
            <p className="text-sm text-gray-500">Your Booking OS is ready. Here's a quick summary:</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <p className="text-2xl font-bold text-blue-600">{staffList.length}</p>
                <p className="text-sm text-gray-500">Staff members</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-2xl font-bold text-blue-600">{services.filter((s: any) => s.isActive !== false).length}</p>
                <p className="text-sm text-gray-500">Services</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-2xl font-bold text-blue-600">{templates.length}</p>
                <p className="text-sm text-gray-500">Templates</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-2xl font-bold text-green-600">Ready</p>
                <p className="text-sm text-gray-500">WhatsApp Simulator</p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => window.open('http://localhost:3002', '_blank')}
                className="w-full border rounded-md py-2.5 text-sm hover:bg-gray-50"
              >
                Open WhatsApp Simulator
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-blue-600 text-white rounded-md py-2.5 text-sm hover:bg-blue-700 font-medium"
              >
                Go to Dashboard
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
            <ChevronLeft size={16} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={handleNext} className="flex items-center gap-1 bg-blue-600 text-white px-6 py-2 rounded-md text-sm hover:bg-blue-700">
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1 bg-green-600 text-white px-6 py-2 rounded-md text-sm hover:bg-green-700">
              <Check size={16} /> Finish Setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

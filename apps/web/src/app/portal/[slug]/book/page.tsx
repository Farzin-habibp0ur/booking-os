'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  User,
} from 'lucide-react';

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

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMins: number;
  price: number;
  category: string | null;
  depositRequired: boolean;
  depositAmount: number | null;
}

interface TimeSlot {
  time: string;
  display: string;
  staffId: string;
  staffName: string;
  available: boolean;
}

type Step = 'service' | 'datetime' | 'confirm';

export default function PortalBookPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [step, setStep] = useState<Step>('service');
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Selections
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState('');

  // Slots
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Booking
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('portal-token');
    if (!token) {
      router.replace(`/portal/${slug}`);
      return;
    }
    portalFetch('/portal/services')
      .then(setServices)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, router]);

  // Load available slots when date changes
  useEffect(() => {
    if (!selectedService || !selectedDate) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    // Use public availability endpoint
    fetch(
      `${API_URL}/public/${slug}/availability?date=${selectedDate}&serviceId=${selectedService.id}`,
    )
      .then((r) => r.json())
      .then((data) => {
        const available = Array.isArray(data) ? data.filter((s: TimeSlot) => s.available) : [];
        setSlots(available);
      })
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, selectedService, slug]);

  const handleSelectService = (svc: Service) => {
    setSelectedService(svc);
    setStep('datetime');
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);
  };

  const handleConfirm = async () => {
    if (!selectedService || !selectedSlot) return;
    setSubmitting(true);
    setError('');
    try {
      await portalPost('/portal/bookings', {
        serviceId: selectedService.id,
        staffId: selectedSlot.staffId,
        startTime: selectedSlot.time,
        notes: notes || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate date navigation
  const changeDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Group services by category
  const categories = services.reduce(
    (acc, svc) => {
      const cat = svc.category || 'Services';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(svc);
      return acc;
    },
    {} as Record<string, Service[]>,
  );

  if (success) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-sage-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Check size={28} className="text-sage-600" />
        </div>
        <h2 className="text-xl font-serif font-semibold text-slate-900">Booking Confirmed!</h2>
        <p className="text-sm text-slate-500 mt-2">
          Your appointment for <span className="font-medium">{selectedService?.name}</span> has been
          booked.
        </p>
        {selectedSlot && (
          <p className="text-sm text-slate-500 mt-1">
            {new Date(selectedSlot.time).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}{' '}
            at{' '}
            {new Date(selectedSlot.time).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
            {selectedSlot.staffName && ` with ${selectedSlot.staffName}`}
          </p>
        )}
        <button
          onClick={() => router.push(`/portal/${slug}/dashboard`)}
          className="mt-6 px-6 py-2 bg-sage-600 text-white text-sm rounded-xl hover:bg-sage-700 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-serif font-semibold text-slate-900">Book an Appointment</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs">
        {(['service', 'datetime', 'confirm'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-slate-200" />}
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full',
                step === s
                  ? 'bg-sage-50 text-sage-800 font-medium'
                  : 'text-slate-400',
              )}
            >
              <span
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                  step === s ? 'bg-sage-600 text-white' : 'bg-slate-200 text-slate-500',
                )}
              >
                {i + 1}
              </span>
              {s === 'service' ? 'Service' : s === 'datetime' ? 'Date & Time' : 'Confirm'}
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: Service selection */}
      {step === 'service' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-slate-400" size={24} />
            </div>
          ) : (
            Object.entries(categories).map(([cat, svcs]) => (
              <div key={cat}>
                <h3 className="text-sm font-medium text-slate-500 mb-2">{cat}</h3>
                <div className="space-y-2">
                  {svcs.map((svc) => (
                    <button
                      key={svc.id}
                      onClick={() => handleSelectService(svc)}
                      className="w-full bg-white rounded-2xl shadow-soft p-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{svc.name}</p>
                          {svc.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{svc.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {svc.durationMins} min
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            ${Number(svc.price).toFixed(2)}
                          </p>
                          {svc.depositRequired && svc.depositAmount && (
                            <p className="text-[10px] text-amber-600 mt-0.5">
                              ${Number(svc.depositAmount).toFixed(2)} deposit
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Step 2: Date & Time selection */}
      {step === 'datetime' && selectedService && (
        <div className="space-y-4">
          <button
            onClick={() => setStep('service')}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft size={14} />
            Change service
          </button>

          <div className="bg-white rounded-2xl shadow-soft p-4">
            <p className="text-sm font-medium text-slate-900">{selectedService.name}</p>
            <p className="text-xs text-slate-500">
              {selectedService.durationMins} min · ${Number(selectedService.price).toFixed(2)}
            </p>
          </div>

          {/* Date picker */}
          <div className="bg-white rounded-2xl shadow-soft p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => changeDate(-1)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <ChevronLeft size={18} className="text-slate-600" />
              </button>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-sage-600" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="text-sm font-medium text-slate-900 bg-transparent border-none focus:ring-0 text-center"
                />
              </div>
              <button
                onClick={() => changeDate(1)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <ChevronRight size={18} className="text-slate-600" />
              </button>
            </div>

            {/* Time slots */}
            {slotsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-slate-400" size={20} />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                No available slots for this date. Try another day.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((slot) => (
                  <button
                    key={`${slot.time}-${slot.staffId}`}
                    onClick={() => setSelectedSlot(slot)}
                    className={cn(
                      'px-3 py-2 rounded-xl text-sm transition-colors text-center',
                      selectedSlot?.time === slot.time && selectedSlot?.staffId === slot.staffId
                        ? 'bg-sage-600 text-white'
                        : 'bg-slate-50 text-slate-700 hover:bg-sage-50',
                    )}
                  >
                    <p className="font-medium">{slot.display}</p>
                    {slot.staffName && (
                      <p className="text-[10px] mt-0.5 opacity-75">{slot.staffName}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedSlot && (
            <button
              onClick={() => setStep('confirm')}
              className="w-full px-4 py-2.5 bg-sage-600 text-white text-sm rounded-xl hover:bg-sage-700 transition-colors font-medium"
            >
              Continue
            </button>
          )}
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && selectedService && selectedSlot && (
        <div className="space-y-4">
          <button
            onClick={() => setStep('datetime')}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft size={14} />
            Change time
          </button>

          <div className="bg-white rounded-2xl shadow-soft p-5 space-y-4">
            <h3 className="text-lg font-serif font-semibold text-slate-900">Booking Summary</h3>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Service</span>
                <span className="font-medium text-slate-900">{selectedService.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Date</span>
                <span className="font-medium text-slate-900">
                  {new Date(selectedSlot.time).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Time</span>
                <span className="font-medium text-slate-900">{selectedSlot.display}</span>
              </div>
              {selectedSlot.staffName && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Practitioner</span>
                  <span className="font-medium text-slate-900 flex items-center gap-1">
                    <User size={14} />
                    {selectedSlot.staffName}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Duration</span>
                <span className="font-medium text-slate-900">{selectedService.durationMins} min</span>
              </div>
              <div className="border-t pt-3 flex justify-between text-sm">
                <span className="font-medium text-slate-900">Total</span>
                <span className="font-semibold text-slate-900">
                  ${Number(selectedService.price).toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any special requests or information..."
                className="w-full bg-slate-50 border-transparent rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-sage-500 resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full px-4 py-2.5 bg-sage-600 text-white text-sm rounded-xl hover:bg-sage-700 transition-colors font-medium disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Booking...
                </span>
              ) : (
                'Confirm Booking'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

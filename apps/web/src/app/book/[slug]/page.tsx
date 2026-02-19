'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { publicApi } from '@/lib/public-api';
import { Skeleton } from '@/components/skeleton';
import { AddToCalendar } from '@/components/add-to-calendar';
import {
  ChevronLeft,
  Clock,
  DollarSign,
  CheckCircle2,
  Calendar,
  User,
  Phone,
  Mail,
  ShieldCheck,
  FileText,
  ClipboardList,
} from 'lucide-react';

interface Business {
  name: string;
  slug: string;
  timezone: string;
  cancellationPolicyText: string;
  reschedulePolicyText: string;
}
interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMins: number;
  price: number;
  category: string;
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
interface BookingResult {
  id: string;
  status: string;
  serviceName: string;
  startTime: string;
  staffName: string | null;
  businessName: string;
  depositRequired: boolean;
  depositAmount: number | null;
}

type Step = 'service' | 'datetime' | 'details' | 'confirm' | 'success';

const STEPS: Step[] = ['service', 'datetime', 'details', 'confirm'];

const STEP_LABELS: Record<Step, string> = {
  service: 'Service',
  datetime: 'Date & Time',
  details: 'Your Details',
  confirm: 'Confirm',
  success: 'Done',
};

import { validateName, validatePhone, validateEmail } from './validators';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function BookingPortalPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Wizard state
  const [step, setStep] = useState<Step>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Waitlist state
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [waitlistName, setWaitlistName] = useState('');
  const [waitlistPhone, setWaitlistPhone] = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistNotes, setWaitlistNotes] = useState('');
  const [waitlistStaffId, setWaitlistStaffId] = useState('');
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [waitlistError, setWaitlistError] = useState('');
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);

  // Load business + services
  useEffect(() => {
    async function load() {
      try {
        const [biz, svcs] = await Promise.all([
          publicApi.get<Business>(`/public/${slug}`),
          publicApi.get<Service[]>(`/public/${slug}/services`),
        ]);
        setBusiness(biz);
        setServices(svcs);
      } catch (err: any) {
        setError(err.message || 'Business not found');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  // Load slots when date changes
  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    publicApi
      .get<TimeSlot[]>(
        `/public/${slug}/availability?date=${selectedDate}&serviceId=${selectedService.id}`,
      )
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, selectedService, slug]);

  const handleBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const validateAndContinue = () => {
    const nameErr = validateName(customerName);
    const phoneErr = validatePhone(customerPhone);
    const emailErr = validateEmail(customerEmail);
    setFieldErrors({ name: nameErr, phone: phoneErr, email: emailErr });
    setTouched({ name: true, phone: true, email: true });
    if (!nameErr && !phoneErr && !emailErr) {
      setStep('confirm');
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === 'name') setFieldErrors((prev) => ({ ...prev, name: validateName(customerName) }));
    if (field === 'phone')
      setFieldErrors((prev) => ({ ...prev, phone: validatePhone(customerPhone) }));
    if (field === 'email')
      setFieldErrors((prev) => ({ ...prev, email: validateEmail(customerEmail) }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await publicApi.post<BookingResult>(`/public/${slug}/book`, {
        serviceId: selectedService!.id,
        staffId: selectedSlot!.staffId,
        startTime: selectedSlot!.time,
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        notes: customerNotes || undefined,
      });
      setBookingResult(result);
      setStep('success');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to book. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate dates for picker: today + 30 days
  const generateDates = () => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  // Load staff for waitlist form when it opens
  useEffect(() => {
    if (showWaitlistForm && staffList.length === 0 && selectedService) {
      publicApi
        .get<any[]>(
          `/public/${slug}/availability?date=${new Date().toISOString().split('T')[0]}&serviceId=${selectedService.id}`,
        )
        .then((slots) => {
          const staffMap = new Map<string, string>();
          slots.forEach((s) => staffMap.set(s.staffId, s.staffName));
          setStaffList(Array.from(staffMap.entries()).map(([id, name]) => ({ id, name })));
        })
        .catch(() => {});
    }
  }, [showWaitlistForm, slug, selectedService]);

  const handleWaitlistSubmit = async () => {
    if (!selectedService) return;
    const nameErr = validateName(waitlistName);
    const phoneErr = validatePhone(waitlistPhone);
    if (nameErr || phoneErr) {
      setWaitlistError(nameErr || phoneErr || 'Please fill in required fields');
      return;
    }
    setWaitlistSubmitting(true);
    setWaitlistError('');
    try {
      await publicApi.post(`/public/${slug}/waitlist`, {
        serviceId: selectedService.id,
        customerName: waitlistName,
        customerPhone: waitlistPhone,
        customerEmail: waitlistEmail || undefined,
        staffId: waitlistStaffId || undefined,
        notes: waitlistNotes || undefined,
      });
      setWaitlistSuccess(true);
    } catch (err: any) {
      setWaitlistError(err.message || 'Failed to join waitlist');
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  // Group slots by staff
  const groupedSlots = slots.reduce(
    (acc, slot) => {
      const key = slot.staffName;
      if (!acc[key]) acc[key] = [];
      acc[key].push(slot);
      return acc;
    },
    {} as Record<string, TimeSlot[]>,
  );

  if (loading) {
    return (
      <div className="space-y-4" data-testid="booking-skeleton">
        <div className="text-center mb-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto mt-2" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-soft p-4 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="text-6xl mb-4">404</div>
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Business not found</h1>
        <p className="text-slate-500 text-sm">
          The booking page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
    );
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-serif font-semibold text-slate-900">{business.name}</h1>
        {step !== 'success' && <p className="text-sm text-slate-500 mt-1">Book an appointment</p>}
      </div>

      {/* Progress dots */}
      {step !== 'success' && (
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i <= stepIndex ? 'bg-sage-600' : 'bg-slate-200'
                }`}
              />
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-0.5 ${i < stepIndex ? 'bg-sage-600' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Step label + back */}
      {step !== 'success' && (
        <div className="flex items-center gap-3 mb-4">
          {stepIndex > 0 && (
            <button
              onClick={handleBack}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <h2 className="text-lg font-semibold text-slate-800">{STEP_LABELS[step]}</h2>
        </div>
      )}

      {/* Step 1: Select Service */}
      {step === 'service' && (
        <div className="space-y-3">
          {services.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
              <p className="text-slate-500">No services available at this time.</p>
            </div>
          ) : (
            services.map((svc) => (
              <button
                key={svc.id}
                onClick={() => {
                  setSelectedService(svc);
                  setStep('datetime');
                }}
                className="w-full bg-white rounded-2xl shadow-soft p-4 text-left hover:shadow-soft-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{svc.name}</p>
                    {svc.description && (
                      <p className="text-sm text-slate-500 mt-0.5">{svc.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">{svc.category}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <Clock size={14} />
                      <span>{svc.durationMins} min</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold text-slate-800 mt-1">
                      <DollarSign size={14} />
                      <span>{svc.price > 0 ? `$${svc.price}` : 'Free'}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Step 2: Date & Time */}
      {step === 'datetime' && (
        <div className="space-y-4">
          {/* Date picker */}
          <div className="bg-white rounded-2xl shadow-soft p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-sage-600" />
              <p className="text-sm font-medium text-slate-700">Select a date</p>
            </div>
            <div
              className="flex gap-2 overflow-x-auto pb-2"
              role="radiogroup"
              aria-label="Select a date"
            >
              {generateDates().map((d, i) => {
                const date = new Date(d + 'T12:00:00');
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = date.getDate();
                const month = date.toLocaleDateString('en-US', { month: 'short' });
                return (
                  <button
                    key={d}
                    role="radio"
                    aria-checked={selectedDate === d}
                    aria-label={`${dayName} ${month} ${dayNum}`}
                    tabIndex={selectedDate === d || (!selectedDate && i === 0) ? 0 : -1}
                    onClick={() => setSelectedDate(d)}
                    onKeyDown={(e) => {
                      const dates = generateDates();
                      const idx = dates.indexOf(d);
                      if (e.key === 'ArrowRight' && idx < dates.length - 1) {
                        e.preventDefault();
                        setSelectedDate(dates[idx + 1]);
                        (e.currentTarget.nextElementSibling as HTMLElement)?.focus();
                      } else if (e.key === 'ArrowLeft' && idx > 0) {
                        e.preventDefault();
                        setSelectedDate(dates[idx - 1]);
                        (e.currentTarget.previousElementSibling as HTMLElement)?.focus();
                      }
                    }}
                    className={`flex-shrink-0 w-16 py-2 rounded-xl text-center transition-colors ${
                      selectedDate === d
                        ? 'bg-sage-600 text-white'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <p className="text-xs">{dayName}</p>
                    <p className="text-lg font-semibold">{dayNum}</p>
                    <p className="text-xs">{month}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="bg-white rounded-2xl shadow-soft p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-700">Available times</p>
                {business && (
                  <p className="text-xs text-slate-400">Times shown in {business.timezone}</p>
                )}
              </div>
              {slotsLoading ? (
                <p className="text-sm text-slate-400 py-4 text-center">
                  Loading available times...
                </p>
              ) : slots.length === 0 ? (
                <div className="py-4 text-center space-y-3">
                  <p className="text-sm text-slate-500">
                    No times available on this day. Try another date.
                  </p>
                  {!showWaitlistForm && !waitlistSuccess && (
                    <button
                      onClick={() => setShowWaitlistForm(true)}
                      className="inline-flex items-center gap-2 bg-lavender-50 text-lavender-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-lavender-100 transition-colors"
                    >
                      <ClipboardList size={16} />
                      Join Waitlist
                    </button>
                  )}
                  {waitlistSuccess && (
                    <div className="bg-sage-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 justify-center text-sage-700">
                        <CheckCircle2 size={18} />
                        <p className="text-sm font-medium">You&apos;re on the waitlist!</p>
                      </div>
                      <p className="text-xs text-sage-600 mt-1">
                        We&apos;ll notify you when a slot opens up.
                      </p>
                    </div>
                  )}
                  {showWaitlistForm && !waitlistSuccess && (
                    <div className="bg-lavender-50 rounded-xl p-4 space-y-3 text-left">
                      <p className="text-sm font-medium text-lavender-800">Join the Waitlist</p>
                      <input
                        value={waitlistName}
                        onChange={(e) => setWaitlistName(e.target.value)}
                        placeholder="Your name *"
                        className="w-full border border-lavender-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-lavender-500 focus:border-transparent outline-none"
                      />
                      <input
                        value={waitlistPhone}
                        onChange={(e) => setWaitlistPhone(e.target.value)}
                        placeholder="Phone number *"
                        type="tel"
                        className="w-full border border-lavender-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-lavender-500 focus:border-transparent outline-none"
                      />
                      <input
                        value={waitlistEmail}
                        onChange={(e) => setWaitlistEmail(e.target.value)}
                        placeholder="Email (optional)"
                        type="email"
                        className="w-full border border-lavender-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-lavender-500 focus:border-transparent outline-none"
                      />
                      {staffList.length > 0 && (
                        <select
                          value={waitlistStaffId}
                          onChange={(e) => setWaitlistStaffId(e.target.value)}
                          className="w-full border border-lavender-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-lavender-500 focus:border-transparent outline-none"
                        >
                          <option value="">Any provider</option>
                          {staffList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <textarea
                        value={waitlistNotes}
                        onChange={(e) => setWaitlistNotes(e.target.value)}
                        placeholder="Preferred times or notes (optional)"
                        rows={2}
                        className="w-full border border-lavender-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-lavender-500 focus:border-transparent outline-none resize-none"
                      />
                      {waitlistError && <p className="text-xs text-red-600">{waitlistError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowWaitlistForm(false)}
                          className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleWaitlistSubmit}
                          disabled={waitlistSubmitting}
                          className="flex-1 bg-lavender-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-lavender-700 transition-colors disabled:opacity-50"
                        >
                          {waitlistSubmitting ? 'Joining...' : 'Join Waitlist'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(groupedSlots).map(([staffName, staffSlots]) => (
                    <div key={staffName}>
                      <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                        <User size={12} /> {staffName}
                      </p>
                      <div
                        className="flex flex-wrap gap-2"
                        role="radiogroup"
                        aria-label={`Time slots for ${staffName}`}
                      >
                        {staffSlots.map((slot) => (
                          <button
                            key={`${slot.staffId}-${slot.time}`}
                            role="radio"
                            aria-checked={
                              selectedSlot?.time === slot.time &&
                              selectedSlot?.staffId === slot.staffId
                            }
                            onClick={() => {
                              setSelectedSlot(slot);
                              setStep('details');
                            }}
                            className={`px-3 py-2 rounded-xl text-sm transition-colors ${
                              selectedSlot?.time === slot.time &&
                              selectedSlot?.staffId === slot.staffId
                                ? 'bg-sage-600 text-white'
                                : 'bg-slate-50 text-slate-700 hover:bg-sage-50 hover:text-sage-700'
                            }`}
                          >
                            {slot.display}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Customer Details */}
      {step === 'details' && (
        <div className="bg-white rounded-2xl shadow-soft p-6 space-y-4">
          <div>
            <label
              htmlFor="booking-name"
              className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1"
            >
              <User size={14} /> Name *
            </label>
            <input
              id="booking-name"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                if (touched.name)
                  setFieldErrors((prev) => ({ ...prev, name: validateName(e.target.value) }));
              }}
              onBlur={() => handleBlur('name')}
              placeholder="Your full name"
              aria-required="true"
              aria-invalid={touched.name && !!fieldErrors.name}
              aria-describedby={touched.name && fieldErrors.name ? 'name-error' : undefined}
              className={`w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none ${
                touched.name && fieldErrors.name ? 'border-red-300' : 'border-slate-200'
              }`}
            />
            {touched.name && fieldErrors.name && (
              <p
                id="name-error"
                className="mt-1 text-xs bg-red-50 text-red-700 px-2 py-1 rounded-lg"
              >
                {fieldErrors.name}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="booking-phone"
              className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1"
            >
              <Phone size={14} /> Phone *
            </label>
            <input
              id="booking-phone"
              value={customerPhone}
              onChange={(e) => {
                setCustomerPhone(e.target.value);
                if (touched.phone)
                  setFieldErrors((prev) => ({ ...prev, phone: validatePhone(e.target.value) }));
              }}
              onBlur={() => handleBlur('phone')}
              placeholder="+1 (555) 123-4567"
              type="tel"
              aria-required="true"
              aria-invalid={touched.phone && !!fieldErrors.phone}
              aria-describedby={touched.phone && fieldErrors.phone ? 'phone-error' : undefined}
              className={`w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none ${
                touched.phone && fieldErrors.phone ? 'border-red-300' : 'border-slate-200'
              }`}
            />
            {touched.phone && fieldErrors.phone && (
              <p
                id="phone-error"
                className="mt-1 text-xs bg-red-50 text-red-700 px-2 py-1 rounded-lg"
              >
                {fieldErrors.phone}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="booking-email"
              className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1"
            >
              <Mail size={14} /> Email (optional)
            </label>
            <input
              id="booking-email"
              value={customerEmail}
              onChange={(e) => {
                setCustomerEmail(e.target.value);
                if (touched.email)
                  setFieldErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
              }}
              onBlur={() => handleBlur('email')}
              placeholder="you@example.com"
              type="email"
              aria-invalid={touched.email && !!fieldErrors.email}
              aria-describedby={touched.email && fieldErrors.email ? 'email-error' : undefined}
              className={`w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none ${
                touched.email && fieldErrors.email ? 'border-red-300' : 'border-slate-200'
              }`}
            />
            {touched.email && fieldErrors.email && (
              <p
                id="email-error"
                className="mt-1 text-xs bg-red-50 text-red-700 px-2 py-1 rounded-lg"
              >
                {fieldErrors.email}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="booking-notes"
              className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1"
            >
              <FileText size={14} /> Notes (optional)
            </label>
            <textarea
              id="booking-notes"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Any special requests or information..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none resize-none"
            />
          </div>
          <button
            onClick={validateAndContinue}
            disabled={!customerName.trim() || !customerPhone.trim()}
            className="w-full bg-sage-600 hover:bg-sage-700 text-white py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 4: Confirmation */}
      {step === 'confirm' && selectedService && selectedSlot && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-soft p-6 space-y-3">
            <h3 className="font-semibold text-slate-800">Booking Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Service</span>
                <span className="font-medium text-slate-800">{selectedService.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date</span>
                <span className="font-medium text-slate-800">{formatDate(selectedSlot.time)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time</span>
                <span className="font-medium text-slate-800">{selectedSlot.display}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Staff</span>
                <span className="font-medium text-slate-800">{selectedSlot.staffName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duration</span>
                <span className="font-medium text-slate-800">
                  {selectedService.durationMins} min
                </span>
              </div>
              <div className="border-t border-slate-100 pt-2 flex justify-between">
                <span className="text-slate-500">Price</span>
                <span className="font-semibold text-slate-800">
                  {selectedService.price > 0 ? `$${selectedService.price}` : 'Free'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-soft p-6 space-y-2">
            <h3 className="font-semibold text-slate-800">Your Details</h3>
            <div className="space-y-1 text-sm">
              <p className="text-slate-600">{customerName}</p>
              <p className="text-slate-600">{customerPhone}</p>
              {customerEmail && <p className="text-slate-600">{customerEmail}</p>}
              {customerNotes && (
                <p className="text-slate-500 italic mt-1">&ldquo;{customerNotes}&rdquo;</p>
              )}
            </div>
          </div>

          {/* Deposit warning */}
          {selectedService.depositRequired && selectedService.depositAmount && (
            <div className="bg-amber-50 rounded-2xl p-4 flex items-start gap-3">
              <DollarSign size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Deposit Required</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  A deposit of ${selectedService.depositAmount} is required to confirm this booking.
                  You&apos;ll receive a payment link after booking.
                </p>
              </div>
            </div>
          )}

          {/* Booking policies */}
          {(business?.cancellationPolicyText || business?.reschedulePolicyText) && (
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck size={14} className="text-slate-500" />
                <p className="text-xs font-medium text-slate-600">Booking Policies</p>
              </div>
              {business.cancellationPolicyText && (
                <p className="text-xs text-slate-500">{business.cancellationPolicyText}</p>
              )}
              {business.reschedulePolicyText && (
                <p className="text-xs text-slate-500 mt-1">{business.reschedulePolicyText}</p>
              )}
            </div>
          )}

          {submitError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{submitError}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-sage-600 hover:bg-sage-700 text-white py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? 'Booking...' : 'Confirm Booking'}
          </button>

          {/* Trust badge */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck size={14} />
            <span>Secure booking powered by Booking OS</span>
          </div>
        </div>
      )}

      {/* Success */}
      {step === 'success' && bookingResult && (
        <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
          <div className="flex justify-center mb-4">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center ${bookingResult.depositRequired ? 'bg-amber-50' : 'bg-sage-50'}`}
            >
              <CheckCircle2
                size={32}
                className={bookingResult.depositRequired ? 'text-amber-600' : 'text-sage-600'}
              />
            </div>
          </div>
          <h2 className="text-xl font-serif font-semibold text-slate-900 mb-2">
            {bookingResult.depositRequired ? 'Deposit Required' : 'Booking Confirmed!'}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {bookingResult.depositRequired
              ? `Your appointment has been reserved. A deposit of $${bookingResult.depositAmount || 0} is required to confirm your booking. You'll receive a payment link shortly.`
              : "You're all set. We look forward to seeing you."}
          </p>
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm text-left">
            <div className="flex justify-between">
              <span className="text-slate-500">Service</span>
              <span className="font-medium text-slate-800">{bookingResult.serviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date</span>
              <span className="font-medium text-slate-800">
                {formatDate(bookingResult.startTime as unknown as string)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Time</span>
              <span className="font-medium text-slate-800">
                {formatTime(bookingResult.startTime as unknown as string)}
              </span>
            </div>
            {bookingResult.staffName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Staff</span>
                <span className="font-medium text-slate-800">{bookingResult.staffName}</span>
              </div>
            )}
          </div>
          {!bookingResult.depositRequired && selectedService && (
            <div className="mt-4">
              <p className="text-xs text-slate-400 mb-2">Add to your calendar</p>
              <AddToCalendar
                title={`${bookingResult.serviceName}${business?.name ? ` at ${business.name}` : ''}`}
                startTime={bookingResult.startTime as unknown as string}
                durationMins={selectedService.durationMins}
                location={business?.name}
              />
            </div>
          )}
          {(business?.cancellationPolicyText || business?.reschedulePolicyText) && (
            <div className="mt-4 bg-slate-50 rounded-xl p-4 text-left">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck size={14} className="text-slate-500" />
                <p className="text-xs font-medium text-slate-600">Booking Policies</p>
              </div>
              {business.cancellationPolicyText && (
                <p className="text-xs text-slate-500">{business.cancellationPolicyText}</p>
              )}
              {business.reschedulePolicyText && (
                <p className="text-xs text-slate-500 mt-1">{business.reschedulePolicyText}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

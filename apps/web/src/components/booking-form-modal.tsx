'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { X, Clock, User, AlertCircle, Repeat } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import { useFocusTrap } from '@/lib/use-focus-trap';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface BookingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (booking: any) => void;
  // Pre-fill props
  customerId?: string;
  customerName?: string;
  conversationId?: string;
  staffId?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  // Reschedule mode
  rescheduleBookingId?: string;
  rescheduleData?: any;
}

interface Slot {
  time: string;
  display: string;
  staffId: string;
  staffName: string;
  available: boolean;
}

export default function BookingFormModal({
  isOpen,
  onClose,
  onCreated,
  customerId,
  customerName,
  conversationId,
  staffId: prefillStaffId,
  date: prefillDate,
  time: prefillTime,
  rescheduleBookingId,
  rescheduleData,
}: BookingFormModalProps) {
  const [services, setServices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || '');
  const [serviceId, setServiceId] = useState(rescheduleData?.serviceId || '');
  const [selectedStaffId, setSelectedStaffId] = useState(prefillStaffId || '');
  const [selectedDate, setSelectedDate] = useState(prefillDate || '');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState(rescheduleData?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [intervalWeeks, setIntervalWeeks] = useState(1);
  const [endMode, setEndMode] = useState<'count' | 'date'>('count');
  const [occurrenceCount, setOccurrenceCount] = useState(8);
  const [endDate, setEndDate] = useState('');
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) return;
    api.get<any>('/services').then((res) => setServices(res.data || res || []));
    api.get<any[]>('/staff').then(setStaff);
    if (!customerId) {
      api.get<any>('/customers?pageSize=100').then((res) => setCustomers(res.data || []));
    }
  }, [isOpen]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelectedCustomerId(customerId || rescheduleData?.customerId || '');
      setServiceId(rescheduleData?.serviceId || '');
      setSelectedStaffId(prefillStaffId || rescheduleData?.staffId || '');
      setSelectedDate(prefillDate || '');
      setSelectedSlot(null);
      setNotes(rescheduleData?.notes || '');
      setError('');
      setSlots([]);
      setIsRecurring(false);
      setRecurringDays([]);
      setIntervalWeeks(1);
      setEndMode('count');
      setOccurrenceCount(8);
      setEndDate('');
    }
  }, [isOpen]);

  // Pre-select time if provided
  useEffect(() => {
    if (prefillDate && prefillTime && slots.length > 0) {
      const match = slots.find(
        (s) => s.display === prefillTime && (!prefillStaffId || s.staffId === prefillStaffId),
      );
      if (match) setSelectedSlot(match);
    }
  }, [slots, prefillDate, prefillTime]);

  // Fetch slots when date + service change
  useEffect(() => {
    if (!selectedDate || !serviceId) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    const params = new URLSearchParams({ date: selectedDate, serviceId });
    if (selectedStaffId) params.set('staffId', selectedStaffId);
    api
      .get<Slot[]>(`/availability?${params}`)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, serviceId, selectedStaffId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError('Please select a time slot');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      if (rescheduleBookingId) {
        // Reschedule existing booking
        const updated = await api.patch<any>(`/bookings/${rescheduleBookingId}`, {
          startTime: selectedSlot.time,
          staffId: selectedSlot.staffId,
          notes: notes || undefined,
        });
        onCreated(updated);
      } else if (isRecurring && recurringDays.length > 0) {
        // Create recurring series
        const slotDate = new Date(selectedSlot.time);
        const timeOfDay = `${slotDate.getHours().toString().padStart(2, '0')}:${slotDate.getMinutes().toString().padStart(2, '0')}`;
        const result = await api.post<any>('/bookings/recurring', {
          customerId: selectedCustomerId,
          serviceId,
          staffId: selectedSlot.staffId,
          startDate: selectedDate,
          timeOfDay,
          daysOfWeek: recurringDays,
          intervalWeeks,
          totalCount: endMode === 'count' ? occurrenceCount : undefined,
          endsAt: endMode === 'date' ? endDate : undefined,
          notes: notes || undefined,
        });
        onCreated(result);
      } else {
        // Create new booking
        const endpoint = conversationId ? `/conversations/${conversationId}/booking` : '/bookings';
        const booking = await api.post<any>(endpoint, {
          customerId: selectedCustomerId,
          serviceId,
          staffId: selectedSlot.staffId,
          startTime: selectedSlot.time,
          notes: notes || undefined,
          conversationId: conversationId || undefined,
        });
        onCreated(booking);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save booking');
    }
    setSubmitting(false);
  };

  if (!isOpen) return null;

  const isReschedule = !!rescheduleBookingId;

  // Group slots by time for multi-staff display
  const groupedSlots = slots.reduce(
    (acc, slot) => {
      if (!acc[slot.display]) acc[slot.display] = [];
      acc[slot.display].push(slot);
      return acc;
    },
    {} as Record<string, Slot[]>,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-form-title"
      ref={modalRef}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[480px] h-full bg-white shadow-soft-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 id="booking-form-title" className="text-lg font-serif font-semibold text-slate-900">
            {isReschedule ? 'Reschedule Booking' : 'Create Booking'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-xl text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Customer */}
          {customerId ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
              <div className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50">
                {customerName || 'Selected customer'}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Service */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Service *</label>
            <select
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setSelectedSlot(null);
              }}
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
            >
              <option value="">Select service...</option>
              {services.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMins}min{s.price > 0 ? ` - $${s.price}` : ''})
                </option>
              ))}
            </select>
            {serviceId &&
              (() => {
                const svc = services.find((s: any) => s.id === serviceId);
                if (!svc || svc.kind === 'OTHER') return null;
                return (
                  <span
                    className={cn(
                      'inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                      svc.kind === 'CONSULT'
                        ? 'bg-lavender-50 text-lavender-900'
                        : 'bg-sage-50 text-sage-900',
                    )}
                  >
                    {svc.kind === 'CONSULT' ? 'Consult' : 'Treatment'}
                  </span>
                );
              })()}
          </div>

          {/* Staff filter (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Staff (optional filter)
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => {
                setSelectedStaffId(e.target.value);
                setSelectedSlot(null);
              }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
            >
              <option value="">Any available staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedSlot(null);
              }}
              min={new Date().toISOString().split('T')[0]}
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
            />
          </div>

          {/* Time slots */}
          {selectedDate && serviceId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Time *{loadingSlots && <span className="text-slate-400 ml-2">Loading...</span>}
              </label>
              {!loadingSlots && slots.length === 0 && (
                <p className="text-sm text-slate-400 bg-gray-50 rounded-md p-3 text-center">
                  No available slots on this date. Try a different date or staff member.
                </p>
              )}
              {!loadingSlots && slots.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-auto">
                  {Object.entries(groupedSlots).map(([display, staffSlots]) => {
                    const availableStaff = staffSlots.filter((s) => s.available);
                    if (availableStaff.length === 0) {
                      return (
                        <button
                          key={display}
                          type="button"
                          disabled
                          className="px-2 py-1.5 rounded-xl border text-xs text-slate-300 bg-slate-50 cursor-not-allowed"
                        >
                          {display}
                        </button>
                      );
                    }
                    const isSelected = selectedSlot?.display === display;
                    return (
                      <button
                        key={display}
                        type="button"
                        onClick={() => setSelectedSlot(availableStaff[0])}
                        className={cn(
                          'px-2 py-1.5 rounded-xl border text-xs transition-colors',
                          isSelected
                            ? 'bg-sage-600 text-white border-sage-600'
                            : 'bg-white hover:bg-sage-50 hover:border-sage-300',
                        )}
                      >
                        <span className="font-medium">{display}</span>
                        {!selectedStaffId && availableStaff.length > 0 && (
                          <span className="block text-[9px] mt-0.5 opacity-70">
                            {availableStaff[0].staffName}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedSlot && (
                <div className="mt-2 flex items-center gap-2 text-sm text-sage-700 bg-sage-50 px-3 py-1.5 rounded-xl">
                  <Clock size={14} />
                  {selectedSlot.display} with {selectedSlot.staffName}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none"
            />
          </div>

          {/* Recurring section — only in create mode */}
          {!isReschedule && (
            <div className="border-t border-slate-100 pt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-slate-300 text-sage-600 focus:ring-sage-500"
                />
                <Repeat size={14} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-700">
                  {t('recurring.repeat_booking')}
                </span>
              </label>

              {isRecurring && (
                <div className="mt-3 space-y-3 pl-6">
                  {/* Days of week */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      {t('recurring.days_of_week')}
                    </label>
                    <div className="flex gap-1">
                      {DAY_LABELS.map((label, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() =>
                            setRecurringDays((prev) =>
                              prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i],
                            )
                          }
                          className={cn(
                            'w-9 h-8 rounded-lg text-xs font-medium transition-colors',
                            recurringDays.includes(i)
                              ? 'bg-sage-600 text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Frequency */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {t('recurring.frequency')}
                    </label>
                    <select
                      value={intervalWeeks}
                      onChange={(e) => setIntervalWeeks(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                    >
                      <option value={1}>{t('recurring.every_week')}</option>
                      <option value={2}>{t('recurring.every_2_weeks')}</option>
                      <option value={3}>{t('recurring.every_3_weeks')}</option>
                      <option value={4}>{t('recurring.every_4_weeks')}</option>
                    </select>
                  </div>

                  {/* End mode */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      {t('recurring.ends')}
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="endMode"
                          checked={endMode === 'count'}
                          onChange={() => setEndMode('count')}
                          className="text-sage-600 focus:ring-sage-500"
                        />
                        <span className="text-sm text-slate-700">
                          {t('recurring.after_occurrences', { count: '' })}
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={52}
                          value={occurrenceCount}
                          onChange={(e) => setOccurrenceCount(Number(e.target.value))}
                          disabled={endMode !== 'count'}
                          className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sage-500 disabled:opacity-50"
                        />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="endMode"
                          checked={endMode === 'date'}
                          onChange={() => setEndMode('date')}
                          className="text-sage-600 focus:ring-sage-500"
                        />
                        <span className="text-sm text-slate-700">{t('recurring.on_date')}</span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={selectedDate || new Date().toISOString().split('T')[0]}
                          disabled={endMode !== 'date'}
                          className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 disabled:opacity-50"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 rounded-xl py-2 text-sm hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedSlot}
              className="flex-1 bg-sage-600 text-white rounded-xl py-2 text-sm hover:bg-sage-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : isReschedule ? 'Reschedule' : 'Create Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

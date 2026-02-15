'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { X, Clock, User, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

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
  isOpen, onClose, onCreated,
  customerId, customerName, conversationId,
  staffId: prefillStaffId, date: prefillDate, time: prefillTime,
  rescheduleBookingId, rescheduleData,
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
    }
  }, [isOpen]);

  // Pre-select time if provided
  useEffect(() => {
    if (prefillDate && prefillTime && slots.length > 0) {
      const match = slots.find((s) => s.display === prefillTime && (!prefillStaffId || s.staffId === prefillStaffId));
      if (match) setSelectedSlot(match);
    }
  }, [slots, prefillDate, prefillTime]);

  // Fetch slots when date + service change
  useEffect(() => {
    if (!selectedDate || !serviceId) { setSlots([]); return; }
    setLoadingSlots(true);
    const params = new URLSearchParams({ date: selectedDate, serviceId });
    if (selectedStaffId) params.set('staffId', selectedStaffId);
    api.get<Slot[]>(`/availability?${params}`)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, serviceId, selectedStaffId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) { setError('Please select a time slot'); return; }
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
      } else {
        // Create new booking
        const endpoint = conversationId
          ? `/conversations/${conversationId}/booking`
          : '/bookings';
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
  const groupedSlots = slots.reduce((acc, slot) => {
    if (!acc[slot.display]) acc[slot.display] = [];
    acc[slot.display].push(slot);
    return acc;
  }, {} as Record<string, Slot[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[480px] h-full bg-white shadow-soft-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-lg font-serif font-semibold text-slate-900">
            {isReschedule ? 'Reschedule Booking' : 'Create Booking'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
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
              <div className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50">{customerName || 'Selected customer'}</div>
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
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>
          )}

          {/* Service */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Service *</label>
            <select
              value={serviceId}
              onChange={(e) => { setServiceId(e.target.value); setSelectedSlot(null); }}
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
          </div>

          {/* Staff filter (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Staff (optional filter)</label>
            <select
              value={selectedStaffId}
              onChange={(e) => { setSelectedStaffId(e.target.value); setSelectedSlot(null); }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
            >
              <option value="">Any available staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null); }}
              min={new Date().toISOString().split('T')[0]}
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
            />
          </div>

          {/* Time slots */}
          {selectedDate && serviceId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Time *
                {loadingSlots && <span className="text-slate-400 ml-2">Loading...</span>}
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

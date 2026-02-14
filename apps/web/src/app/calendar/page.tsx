'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import BookingFormModal from '@/components/booking-form-modal';
import BookingDetailModal from '@/components/booking-detail-modal';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8am - 7pm
const SLOT_HEIGHT = 60; // pixels per hour

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  PENDING: { bg: 'bg-yellow-50', border: 'border-l-yellow-500', text: 'text-yellow-800' },
  CONFIRMED: { bg: 'bg-blue-50', border: 'border-l-blue-500', text: 'text-blue-800' },
  IN_PROGRESS: { bg: 'bg-green-50', border: 'border-l-green-500', text: 'text-green-800' },
  COMPLETED: { bg: 'bg-gray-50', border: 'border-l-gray-400', text: 'text-gray-500' },
  CANCELLED: { bg: 'bg-red-50', border: 'border-l-red-300', text: 'text-red-400 line-through' },
  NO_SHOW: { bg: 'bg-orange-50', border: 'border-l-orange-400', text: 'text-orange-500' },
};

export default function CalendarPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week'>('day');
  const [hoveredBooking, setHoveredBooking] = useState<string | null>(null);

  // Modals
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [bookingDetailOpen, setBookingDetailOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [prefillDate, setPrefillDate] = useState('');
  const [prefillTime, setPrefillTime] = useState('');
  const [prefillStaffId, setPrefillStaffId] = useState('');
  const [rescheduleMode, setRescheduleMode] = useState(false);

  useEffect(() => {
    api.get<any[]>('/staff').then((s) => {
      setStaff(s);
      setSelectedStaff(s.map((st: any) => st.id));
    });
  }, []);

  useEffect(() => {
    loadBookings();
  }, [currentDate, view]);

  const loadBookings = () => {
    const dateFrom = new Date(currentDate);
    if (view === 'week') {
      dateFrom.setDate(dateFrom.getDate() - dateFrom.getDay());
    }
    dateFrom.setHours(0, 0, 0, 0);
    const dateTo = new Date(dateFrom);
    dateTo.setDate(dateTo.getDate() + (view === 'week' ? 7 : 1));

    api.get<any[]>(`/bookings/calendar?dateFrom=${dateFrom.toISOString()}&dateTo=${dateTo.toISOString()}`)
      .then(setBookings)
      .catch(console.error);
  };

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir * (view === 'week' ? 7 : 1));
    setCurrentDate(d);
  };

  const displayStaff = useMemo(() => {
    return staff.filter((s) => selectedStaff.includes(s.id));
  }, [staff, selectedStaff]);

  const getDaysInView = () => {
    if (view === 'day') return [new Date(currentDate)];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const days = getDaysInView();

  const getBookingsForStaffDay = (staffId: string, day: Date) => {
    return bookings.filter((b) => {
      const start = new Date(b.startTime);
      return b.staffId === staffId && start.toDateString() === day.toDateString();
    });
  };

  const getBookingPosition = (booking: any) => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const top = (startHour - 8) * SLOT_HEIGHT;
    const height = Math.max((endHour - startHour) * SLOT_HEIGHT, 20);
    return { top, height };
  };

  const handleSlotClick = (staffId: string, day: Date, hour: number) => {
    const dateStr = day.toISOString().split('T')[0];
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    setPrefillDate(dateStr);
    setPrefillTime(timeStr);
    setPrefillStaffId(staffId);
    setRescheduleMode(false);
    setSelectedBooking(null);
    setBookingFormOpen(true);
  };

  const handleBookingClick = (booking: any) => {
    setSelectedBooking(booking);
    setBookingDetailOpen(true);
  };

  const handleReschedule = (booking: any) => {
    setBookingDetailOpen(false);
    setSelectedBooking(booking);
    setRescheduleMode(true);
    setPrefillDate('');
    setPrefillTime('');
    setPrefillStaffId('');
    setBookingFormOpen(true);
  };

  const handleBookingUpdated = () => {
    setBookingDetailOpen(false);
    setBookingFormOpen(false);
    setRescheduleMode(false);
    loadBookings();
  };

  const toggleStaffFilter = (staffId: string) => {
    setSelectedStaff((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId],
    );
  };

  // In day view, columns = staff. In week view, columns = days
  const isStaffColumns = view === 'day';

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Calendar</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={20} /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 border rounded text-sm hover:bg-gray-50">Today</button>
            <button onClick={() => navigate(1)} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={20} /></button>
          </div>
          <h2 className="text-lg text-gray-600">
            {view === 'day'
              ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
              : `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Staff filter chips */}
          <div className="flex items-center gap-1">
            {staff.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleStaffFilter(s.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                  selectedStaff.includes(s.id)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-400',
                )}
              >
                {s.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
            <button onClick={() => setView('day')} className={cn('px-3 py-1 rounded text-sm', view === 'day' && 'bg-white shadow-sm font-medium')}>Day</button>
            <button onClick={() => setView('week')} className={cn('px-3 py-1 rounded text-sm', view === 'week' && 'bg-white shadow-sm font-medium')}>Week</button>
          </div>

          <button
            onClick={() => { setRescheduleMode(false); setSelectedBooking(null); setPrefillDate(currentDate.toISOString().split('T')[0]); setPrefillTime(''); setPrefillStaffId(''); setBookingFormOpen(true); }}
            className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"
          >
            <Plus size={14} /> New Booking
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 bg-white border rounded-lg overflow-auto">
        {isStaffColumns ? (
          /* DAY VIEW: columns = staff */
          <div className="flex min-h-full">
            {/* Time gutter */}
            <div className="w-16 flex-shrink-0 border-r">
              <div className="h-12 border-b" /> {/* header spacer */}
              {HOURS.map((hour) => (
                <div key={hour} className="relative" style={{ height: SLOT_HEIGHT }}>
                  <span className="absolute -top-2 right-2 text-xs text-gray-400">
                    {hour % 12 || 12}{hour < 12 ? 'am' : 'pm'}
                  </span>
                </div>
              ))}
            </div>

            {/* Staff columns */}
            {displayStaff.map((s) => (
              <div key={s.id} className="flex-1 min-w-[180px] border-r last:border-r-0">
                {/* Staff header */}
                <div className="h-12 border-b flex items-center justify-center sticky top-0 bg-white z-10">
                  <div className="text-center">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-[10px] text-gray-400">{s.role}</p>
                  </div>
                </div>

                {/* Time slots */}
                <div className="relative">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      onClick={() => handleSlotClick(s.id, currentDate, hour)}
                      className="border-b border-dashed border-gray-100 cursor-pointer hover:bg-blue-50/30 transition-colors"
                      style={{ height: SLOT_HEIGHT }}
                    />
                  ))}

                  {/* Booking cards */}
                  {getBookingsForStaffDay(s.id, currentDate).map((b) => {
                    const { top, height } = getBookingPosition(b);
                    const colors = STATUS_COLORS[b.status] || STATUS_COLORS.CONFIRMED;
                    return (
                      <div
                        key={b.id}
                        onClick={(e) => { e.stopPropagation(); handleBookingClick(b); }}
                        onMouseEnter={() => setHoveredBooking(b.id)}
                        onMouseLeave={() => setHoveredBooking(null)}
                        className={cn(
                          'absolute left-1 right-1 rounded border-l-3 px-2 py-1 cursor-pointer transition-shadow',
                          colors.bg, colors.border,
                          hoveredBooking === b.id && 'shadow-md ring-1 ring-blue-200',
                        )}
                        style={{ top, height, borderLeftWidth: 3 }}
                      >
                        <p className={cn('text-xs font-medium truncate', colors.text)}>
                          {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs font-medium truncate">{b.customer?.name}</p>
                        {height > 35 && <p className="text-[10px] text-gray-500 truncate">{b.service?.name}</p>}

                        {/* Hover tooltip */}
                        {hoveredBooking === b.id && (
                          <div className="absolute z-20 left-full top-0 ml-2 bg-white border shadow-lg rounded-md p-2.5 w-48 pointer-events-none">
                            <p className="text-sm font-medium">{b.customer?.name}</p>
                            <p className="text-xs text-gray-500">{b.service?.name} · {b.service?.durationMins}min</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {' – '}
                              {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">with {b.staff?.name}</p>
                            <span className={cn('inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-1',
                              STATUS_COLORS[b.status]?.bg, STATUS_COLORS[b.status]?.text?.replace('line-through', ''),
                            )}>{b.status}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* WEEK VIEW: columns = days */
          <div className="flex min-h-full">
            {/* Time gutter */}
            <div className="w-16 flex-shrink-0 border-r">
              <div className="h-12 border-b" />
              {HOURS.map((hour) => (
                <div key={hour} className="relative" style={{ height: SLOT_HEIGHT }}>
                  <span className="absolute -top-2 right-2 text-xs text-gray-400">
                    {hour % 12 || 12}{hour < 12 ? 'am' : 'pm'}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const isToday = day.toDateString() === new Date().toDateString();
              const dayBookings = bookings.filter((b) => {
                const start = new Date(b.startTime);
                return start.toDateString() === day.toDateString() && selectedStaff.includes(b.staffId);
              });

              return (
                <div key={day.toISOString()} className="flex-1 min-w-[120px] border-r last:border-r-0">
                  {/* Day header */}
                  <div className={cn('h-12 border-b flex flex-col items-center justify-center sticky top-0 bg-white z-10', isToday && 'bg-blue-50')}>
                    <p className="text-[10px] text-gray-500 uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                    <p className={cn('text-sm font-semibold', isToday && 'text-blue-600')}>{day.getDate()}</p>
                  </div>

                  {/* Slots */}
                  <div className="relative">
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        onClick={() => handleSlotClick(displayStaff[0]?.id || '', day, hour)}
                        className="border-b border-dashed border-gray-100 cursor-pointer hover:bg-blue-50/30"
                        style={{ height: SLOT_HEIGHT }}
                      />
                    ))}

                    {/* Bookings */}
                    {dayBookings.map((b) => {
                      const { top, height } = getBookingPosition(b);
                      const colors = STATUS_COLORS[b.status] || STATUS_COLORS.CONFIRMED;
                      return (
                        <div
                          key={b.id}
                          onClick={(e) => { e.stopPropagation(); handleBookingClick(b); }}
                          className={cn('absolute left-0.5 right-0.5 rounded border-l-2 px-1 py-0.5 cursor-pointer hover:shadow-md', colors.bg, colors.border)}
                          style={{ top, height, borderLeftWidth: 2 }}
                        >
                          <p className="text-[10px] font-medium truncate">{b.customer?.name}</p>
                          <p className="text-[9px] text-gray-500 truncate">{new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {bookings.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-gray-400">No bookings scheduled</p>
              <p className="text-sm text-gray-300">Click on the calendar to create one</p>
            </div>
          </div>
        )}
      </div>

      {/* Booking form modal */}
      <BookingFormModal
        isOpen={bookingFormOpen}
        onClose={() => { setBookingFormOpen(false); setRescheduleMode(false); }}
        onCreated={handleBookingUpdated}
        date={prefillDate}
        time={prefillTime}
        staffId={prefillStaffId}
        rescheduleBookingId={rescheduleMode ? selectedBooking?.id : undefined}
        rescheduleData={rescheduleMode ? selectedBooking : undefined}
      />

      {/* Booking detail modal */}
      <BookingDetailModal
        booking={selectedBooking}
        isOpen={bookingDetailOpen}
        onClose={() => setBookingDetailOpen(false)}
        onUpdated={handleBookingUpdated}
        onReschedule={handleReschedule}
      />
    </div>
  );
}

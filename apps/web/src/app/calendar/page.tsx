'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { ChevronLeft, ChevronRight, Plus, Repeat, MapPin, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import BookingFormModal from '@/components/booking-form-modal';
import BookingDetailModal from '@/components/booking-detail-modal';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8am - 7pm
const SLOT_HEIGHT = 60; // pixels per hour

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  PENDING: { bg: 'bg-lavender-50', border: 'border-l-lavender-500', text: 'text-lavender-900' },
  PENDING_DEPOSIT: { bg: 'bg-amber-50', border: 'border-l-amber-400', text: 'text-amber-700' },
  CONFIRMED: { bg: 'bg-sage-50', border: 'border-l-sage-500', text: 'text-sage-900' },
  IN_PROGRESS: { bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-700' },
  COMPLETED: { bg: 'bg-slate-50', border: 'border-l-slate-400', text: 'text-slate-500' },
  CANCELLED: { bg: 'bg-red-50', border: 'border-l-red-300', text: 'text-red-400 line-through' },
  NO_SHOW: { bg: 'bg-red-50', border: 'border-l-red-400', text: 'text-red-500' },
};

export default function CalendarPage() {
  const { t } = useI18n();
  const [bookings, setBookings] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [monthSummary, setMonthSummary] = useState<
    Record<string, { total: number; confirmed: number; pending: number; cancelled: number }>
  >({});
  const [hoveredBooking, setHoveredBooking] = useState<string | null>(null);
  const [calendarContext, setCalendarContext] = useState<
    Record<
      string,
      {
        workingHours: { dayOfWeek: number; startTime: string; endTime: string; isOff: boolean }[];
        timeOff: { startDate: string; endDate: string; reason: string | null }[];
      }
    >
  >({});

  // Modals
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [bookingDetailOpen, setBookingDetailOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [prefillDate, setPrefillDate] = useState('');
  const [prefillTime, setPrefillTime] = useState('');
  const [prefillStaffId, setPrefillStaffId] = useState('');
  const [rescheduleMode, setRescheduleMode] = useState(false);

  // Drag-and-drop state
  const [dragBooking, setDragBooking] = useState<any>(null);
  const [dropTarget, setDropTarget] = useState<{
    staffId: string;
    day: Date;
    hour: number;
    minutes: number;
  } | null>(null);
  const [showDropConfirm, setShowDropConfirm] = useState(false);
  const [dropConflict, setDropConflict] = useState(false);

  useEffect(() => {
    api.get<any[]>('/staff').then((s) => {
      setStaff(s);
      setSelectedStaff(s.map((st: any) => st.id));
    });
    api
      .get<any[]>('/locations')
      .then(setLocations)
      .catch(() => setLocations([]));
  }, []);

  useEffect(() => {
    if (view === 'month') {
      loadMonthSummary();
    } else {
      loadBookings();
      loadCalendarContext();
    }
  }, [currentDate, view, selectedLocationId]);

  useEffect(() => {
    if (staff.length > 0 && view !== 'month') {
      loadCalendarContext();
    }
  }, [staff]);

  const loadBookings = () => {
    const dateFrom = new Date(currentDate);
    if (view === 'week') {
      dateFrom.setDate(dateFrom.getDate() - dateFrom.getDay());
    }
    dateFrom.setHours(0, 0, 0, 0);
    const dateTo = new Date(dateFrom);
    dateTo.setDate(dateTo.getDate() + (view === 'week' ? 7 : 1));

    const params = new URLSearchParams({
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    });
    if (selectedLocationId) params.set('locationId', selectedLocationId);

    api.get<any[]>(`/bookings/calendar?${params}`).then(setBookings).catch(console.error);
  };

  const loadCalendarContext = () => {
    if (staff.length === 0) return;
    const dateFrom = new Date(currentDate);
    if (view === 'week') {
      dateFrom.setDate(dateFrom.getDate() - dateFrom.getDay());
    }
    dateFrom.setHours(0, 0, 0, 0);
    const dateTo = new Date(dateFrom);
    dateTo.setDate(dateTo.getDate() + (view === 'week' ? 7 : 1));

    const staffIds = staff.map((s: any) => s.id).join(',');
    const params = new URLSearchParams({
      staffIds,
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    });
    api
      .get<typeof calendarContext>(`/availability/calendar-context?${params}`)
      .then(setCalendarContext)
      .catch(() => setCalendarContext({}));
  };

  const isNonWorkingHour = (staffId: string, day: Date, hour: number) => {
    const ctx = calendarContext[staffId];
    if (!ctx || ctx.workingHours.length === 0) return false;
    const dayOfWeek = day.getDay();
    const wh = ctx.workingHours.find((w) => w.dayOfWeek === dayOfWeek);
    if (!wh || wh.isOff) return true;
    const startHour = parseInt(wh.startTime.split(':')[0], 10);
    const endHour = parseInt(wh.endTime.split(':')[0], 10);
    return hour < startHour || hour >= endHour;
  };

  const isTimeOff = (staffId: string, day: Date) => {
    const ctx = calendarContext[staffId];
    if (!ctx) return false;
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return ctx.timeOff.some((to) => {
      const start = new Date(to.startDate);
      const end = new Date(to.endDate);
      return start <= dayEnd && end >= dayStart;
    });
  };

  const loadMonthSummary = () => {
    const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const params = new URLSearchParams({ month });
    if (selectedLocationId) params.set('locationId', selectedLocationId);
    api
      .get<{ days: typeof monthSummary }>(`/bookings/calendar/month-summary?${params}`)
      .then((res) => setMonthSummary(res.days))
      .catch(console.error);
  };

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === 'month') {
      d.setMonth(d.getMonth() + dir);
    } else {
      d.setDate(d.getDate() + dir * (view === 'week' ? 7 : 1));
    }
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
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId],
    );
  };

  // Month view helpers
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay(); // 0=Sunday
    const totalDays = lastDay.getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const handleMonthDayClick = (day: Date) => {
    setCurrentDate(day);
    setView('day');
  };

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, booking: any) => {
    setDragBooking(booking);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', booking.id);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, staffId: string, day: Date, hour: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // Snap to 30-min grid
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const minutes = offsetY < SLOT_HEIGHT / 2 ? 0 : 30;
      setDropTarget({ staffId, day, hour, minutes });
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, staffId: string, day: Date, hour: number) => {
      e.preventDefault();
      if (!dragBooking) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const minutes = offsetY < SLOT_HEIGHT / 2 ? 0 : 30;

      // Check for conflicts
      const newStartTime = new Date(day);
      newStartTime.setHours(hour, minutes, 0, 0);
      const duration = dragBooking.service?.durationMins || 60;
      const newEndTime = new Date(newStartTime.getTime() + duration * 60000);

      const hasConflict = bookings.some((b) => {
        if (b.id === dragBooking.id) return false;
        if (b.staffId !== staffId) return false;
        const bStart = new Date(b.startTime).getTime();
        const bEnd = new Date(b.endTime).getTime();
        return newStartTime.getTime() < bEnd && newEndTime.getTime() > bStart;
      });

      setDropTarget({ staffId, day, hour, minutes });
      setDropConflict(hasConflict);
      setShowDropConfirm(true);
    },
    [dragBooking, bookings],
  );

  const confirmDrop = useCallback(async () => {
    if (!dragBooking || !dropTarget) return;

    const newStartTime = new Date(dropTarget.day);
    newStartTime.setHours(dropTarget.hour, dropTarget.minutes, 0, 0);
    const duration = dragBooking.service?.durationMins || 60;
    const newEndTime = new Date(newStartTime.getTime() + duration * 60000);

    try {
      await api.patch(`/bookings/${dragBooking.id}`, {
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString(),
        staffId: dropTarget.staffId,
      });
      loadBookings();
    } catch (err) {
      console.error('Failed to reschedule:', err);
    }

    setShowDropConfirm(false);
    setDragBooking(null);
    setDropTarget(null);
    setDropConflict(false);
  }, [dragBooking, dropTarget]);

  const cancelDrop = useCallback(() => {
    setShowDropConfirm(false);
    setDragBooking(null);
    setDropTarget(null);
    setDropConflict(false);
  }, []);

  // In day view, columns = staff. In week view, columns = days
  const isStaffColumns = view === 'day';

  return (
    <div className="p-6 h-full flex flex-col" data-tour-target="calendar-grid">
      {/* Top bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-serif font-semibold text-slate-900">
            {t('calendar.title')}
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 transition-colors"
            >
              {t('calendar.today')}
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <h2 className="text-lg text-slate-500">
            {view === 'month'
              ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : view === 'day'
                ? currentDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Location filter */}
          {locations.length > 0 && (
            <div className="flex items-center gap-1.5">
              <MapPin size={14} className="text-slate-400" />
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="border border-slate-200 rounded-xl px-2.5 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
              >
                <option value="">All locations</option>
                {locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Staff filter chips */}
          <div className="flex flex-wrap items-center gap-1">
            {staff.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleStaffFilter(s.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                  selectedStaff.includes(s.id)
                    ? 'bg-sage-100 text-sage-700'
                    : 'bg-slate-100 text-slate-400',
                )}
              >
                {s.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex gap-0.5 bg-slate-100 rounded-xl p-0.5">
            <button
              onClick={() => setView('day')}
              className={cn(
                'px-3 py-1 rounded-lg text-sm transition-colors',
                view === 'day' && 'bg-white shadow-sm font-medium',
              )}
            >
              {t('calendar.view_day')}
            </button>
            <button
              onClick={() => setView('week')}
              className={cn(
                'px-3 py-1 rounded-lg text-sm transition-colors',
                view === 'week' && 'bg-white shadow-sm font-medium',
              )}
            >
              {t('calendar.view_week')}
            </button>
            <button
              onClick={() => setView('month')}
              className={cn(
                'px-3 py-1 rounded-lg text-sm transition-colors',
                view === 'month' && 'bg-white shadow-sm font-medium',
              )}
            >
              {t('calendar.view_month')}
            </button>
          </div>

          <button
            onClick={() => {
              setRescheduleMode(false);
              setSelectedBooking(null);
              setPrefillDate(currentDate.toISOString().split('T')[0]);
              setPrefillTime('');
              setPrefillStaffId('');
              setBookingFormOpen(true);
            }}
            className="flex items-center gap-1 bg-sage-600 text-white px-3 py-1.5 rounded-xl text-sm hover:bg-sage-700 transition-colors"
          >
            <Plus size={14} /> {t('calendar.new_booking')}
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 bg-white rounded-2xl shadow-soft overflow-auto">
        {view === 'month' ? (
          /* MONTH VIEW: 6x7 grid */
          <div className="p-4">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-medium text-slate-400 uppercase py-1"
                >
                  {d}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {getMonthDays().map((day, idx) => {
                if (!day) {
                  return (
                    <div key={`empty-${idx}`} className="min-h-[80px] rounded-xl bg-slate-50/50" />
                  );
                }
                const dayKey = day.toISOString().split('T')[0];
                const summary = monthSummary[dayKey];
                const isToday = day.toDateString() === new Date().toDateString();
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                return (
                  <button
                    key={dayKey}
                    onClick={() => handleMonthDayClick(day)}
                    className={cn(
                      'min-h-[80px] rounded-xl p-2 text-left transition-colors hover:bg-slate-50 border',
                      isToday ? 'border-sage-300 bg-sage-50/30' : 'border-transparent',
                      !isCurrentMonth && 'opacity-50',
                    )}
                  >
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isToday ? 'text-sage-600' : 'text-slate-700',
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {summary && summary.total > 0 && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        {summary.confirmed > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sage-500" />
                            <span className="text-[10px] text-sage-700">{summary.confirmed}</span>
                          </div>
                        )}
                        {summary.pending > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-lavender-500" />
                            <span className="text-[10px] text-lavender-700">{summary.pending}</span>
                          </div>
                        )}
                        {summary.cancelled > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            <span className="text-[10px] text-red-500">{summary.cancelled}</span>
                          </div>
                        )}
                        <span className="text-[10px] text-slate-400 font-medium">
                          {summary.total} total
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : isStaffColumns ? (
          /* DAY VIEW: columns = staff */
          <div className="flex min-h-full">
            {/* Time gutter */}
            <div className="w-16 flex-shrink-0 border-r">
              <div className="h-12 border-b" /> {/* header spacer */}
              {HOURS.map((hour) => (
                <div key={hour} className="relative" style={{ height: SLOT_HEIGHT }}>
                  <span className="absolute -top-2 right-2 text-xs text-slate-400">
                    {hour % 12 || 12}
                    {hour < 12 ? 'am' : 'pm'}
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
                    <p className="text-sm font-serif font-medium">{s.name}</p>
                    <p className="text-[10px] text-slate-400">{s.role}</p>
                  </div>
                </div>

                {/* Time-off banner */}
                {isTimeOff(s.id, currentDate) && (
                  <div className="text-center text-[10px] text-red-500 bg-red-50/50 py-0.5 font-medium">
                    Time Off
                  </div>
                )}

                {/* Time slots */}
                <div className="relative">
                  {HOURS.map((hour) => {
                    const nonWorking = isNonWorkingHour(s.id, currentDate, hour);
                    const offDay = isTimeOff(s.id, currentDate);
                    return (
                      <div
                        key={hour}
                        onClick={() => !offDay && handleSlotClick(s.id, currentDate, hour)}
                        onDragOver={(e) => !offDay && handleDragOver(e, s.id, currentDate, hour)}
                        onDrop={(e) => !offDay && handleDrop(e, s.id, currentDate, hour)}
                        className={cn(
                          'border-b border-dashed border-slate-100 transition-colors',
                          offDay
                            ? 'bg-red-50/50 cursor-not-allowed'
                            : nonWorking
                              ? 'bg-slate-100/60 cursor-pointer'
                              : 'cursor-pointer hover:bg-sage-50/30',
                          dropTarget?.staffId === s.id &&
                            dropTarget?.hour === hour &&
                            'bg-sage-100/50 ring-1 ring-sage-300',
                        )}
                        style={{ height: SLOT_HEIGHT }}
                      />
                    );
                  })}

                  {/* Booking cards */}
                  {getBookingsForStaffDay(s.id, currentDate).map((b) => {
                    const { top, height } = getBookingPosition(b);
                    const colors = STATUS_COLORS[b.status] || STATUS_COLORS.CONFIRMED;
                    return (
                      <div
                        key={b.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, b)}
                        onDragEnd={() => {
                          if (!showDropConfirm) {
                            setDragBooking(null);
                            setDropTarget(null);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookingClick(b);
                        }}
                        onMouseEnter={() => setHoveredBooking(b.id)}
                        onMouseLeave={() => setHoveredBooking(null)}
                        className={cn(
                          'absolute left-1 right-1 rounded-xl px-2 py-1 cursor-pointer transition-shadow shadow-soft-sm',
                          colors.bg,
                          colors.border,
                          hoveredBooking === b.id && 'shadow-md ring-1 ring-sage-200',
                        )}
                        style={{ top, height, borderLeftWidth: 3 }}
                      >
                        <p
                          className={cn(
                            'text-xs font-medium truncate flex items-center gap-1',
                            colors.text,
                          )}
                        >
                          {b.recurringSeriesId && <Repeat size={9} className="flex-shrink-0" />}
                          {new Date(b.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' – '}
                          {new Date(b.endTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="text-xs font-medium truncate">{b.customer?.name}</p>
                        {height > 35 && (
                          <p className="text-[10px] text-slate-500 truncate">
                            {b.service?.name}
                            {b.service?.kind === 'CONSULT' && (
                              <span className="ml-1 text-[9px] bg-lavender-50 text-lavender-900 px-1 py-0 rounded-full">
                                C
                              </span>
                            )}
                            {b.service?.kind === 'TREATMENT' && (
                              <span className="ml-1 text-[9px] bg-sage-50 text-sage-900 px-1 py-0 rounded-full">
                                T
                              </span>
                            )}
                          </p>
                        )}

                        {/* Hover tooltip */}
                        {hoveredBooking === b.id && (
                          <div className="absolute z-20 left-full top-0 ml-2 bg-white shadow-soft rounded-xl p-2.5 w-48 pointer-events-none">
                            <p className="text-sm font-medium">{b.customer?.name}</p>
                            <p className="text-xs text-slate-500">
                              {b.service?.name} · {b.service?.durationMins}min
                              {b.service?.kind === 'CONSULT' && (
                                <span className="ml-1 text-[9px] bg-lavender-50 text-lavender-900 px-1 py-0 rounded-full">
                                  Consult
                                </span>
                              )}
                              {b.service?.kind === 'TREATMENT' && (
                                <span className="ml-1 text-[9px] bg-sage-50 text-sage-900 px-1 py-0 rounded-full">
                                  Treatment
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {new Date(b.startTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {' – '}
                              {new Date(b.endTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {t('calendar.with_staff', { name: b.staff?.name })}
                            </p>
                            <span
                              className={cn(
                                'inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-1',
                                STATUS_COLORS[b.status]?.bg,
                                STATUS_COLORS[b.status]?.text?.replace('line-through', ''),
                              )}
                            >
                              {t(`status.${b.status.toLowerCase()}`)}
                            </span>
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
                  <span className="absolute -top-2 right-2 text-xs text-slate-400">
                    {hour % 12 || 12}
                    {hour < 12 ? 'am' : 'pm'}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const isToday = day.toDateString() === new Date().toDateString();
              const dayBookings = bookings.filter((b) => {
                const start = new Date(b.startTime);
                return (
                  start.toDateString() === day.toDateString() && selectedStaff.includes(b.staffId)
                );
              });

              return (
                <div
                  key={day.toISOString()}
                  className="flex-1 min-w-[120px] border-r last:border-r-0"
                >
                  {/* Day header */}
                  <div
                    className={cn(
                      'h-12 border-b flex flex-col items-center justify-center sticky top-0 bg-white z-10',
                      isToday && 'bg-sage-50',
                    )}
                  >
                    <p className="text-[10px] text-slate-500 uppercase">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </p>
                    <p className={cn('text-sm font-semibold', isToday && 'text-sage-600')}>
                      {day.getDate()}
                    </p>
                  </div>

                  {/* Slots */}
                  <div className="relative">
                    {HOURS.map((hour) => {
                      // In week view, check if any selected staff has this as non-working
                      const anyTimeOff = displayStaff.some((s) => isTimeOff(s.id, day));
                      const allNonWorking =
                        displayStaff.length > 0 &&
                        displayStaff.every((s) => isNonWorkingHour(s.id, day, hour));
                      return (
                        <div
                          key={hour}
                          onClick={() =>
                            !anyTimeOff && handleSlotClick(displayStaff[0]?.id || '', day, hour)
                          }
                          className={cn(
                            'border-b border-dashed border-slate-100',
                            anyTimeOff
                              ? 'bg-red-50/50 cursor-not-allowed'
                              : allNonWorking
                                ? 'bg-slate-100/60 cursor-pointer'
                                : 'cursor-pointer hover:bg-sage-50/30',
                          )}
                          style={{ height: SLOT_HEIGHT }}
                        />
                      );
                    })}

                    {/* Bookings */}
                    {dayBookings.map((b) => {
                      const { top, height } = getBookingPosition(b);
                      const colors = STATUS_COLORS[b.status] || STATUS_COLORS.CONFIRMED;
                      return (
                        <div
                          key={b.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBookingClick(b);
                          }}
                          className={cn(
                            'absolute left-0.5 right-0.5 rounded border-l-2 px-1 py-0.5 cursor-pointer hover:shadow-md',
                            colors.bg,
                            colors.border,
                          )}
                          style={{ top, height, borderLeftWidth: 2 }}
                        >
                          <p className="text-[10px] font-medium truncate flex items-center gap-0.5">
                            {b.recurringSeriesId && <Repeat size={8} className="flex-shrink-0" />}
                            {b.customer?.name}
                          </p>
                          <p className="text-[9px] text-slate-500 truncate">
                            {new Date(b.startTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
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
        {view !== 'month' && bookings.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-slate-400">{t('calendar.no_bookings')}</p>
              <p className="text-sm text-slate-300">{t('calendar.click_to_create')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Drop confirmation popover */}
      {showDropConfirm && dragBooking && dropTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          onClick={cancelDrop}
        >
          <div
            className="bg-white rounded-2xl shadow-soft p-4 max-w-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {dropConflict && (
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <AlertTriangle size={16} />
                <span className="text-sm font-medium">Conflicting booking detected</span>
              </div>
            )}
            <p className="text-sm text-slate-700 mb-1">
              Reschedule <strong>{dragBooking.customer?.name}</strong>?
            </p>
            <p className="text-xs text-slate-500 mb-3">
              {dropTarget.day.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
              {' at '}
              {dropTarget.hour % 12 || 12}:{dropTarget.minutes.toString().padStart(2, '0')}
              {dropTarget.hour < 12 ? 'am' : 'pm'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={cancelDrop}
                className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDrop}
                className="flex-1 px-3 py-1.5 text-sm bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors"
              >
                {dropConflict ? 'Reschedule Anyway' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking form modal */}
      <BookingFormModal
        isOpen={bookingFormOpen}
        onClose={() => {
          setBookingFormOpen(false);
          setRescheduleMode(false);
        }}
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

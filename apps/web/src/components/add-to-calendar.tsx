'use client';

import { Calendar, Download } from 'lucide-react';

interface AddToCalendarProps {
  title: string;
  startTime: string;
  durationMins: number;
  location?: string;
  description?: string;
}

function toGoogleCalendarUrl(props: AddToCalendarProps): string {
  const start = new Date(props.startTime);
  const end = new Date(start.getTime() + props.durationMins * 60 * 1000);

  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: props.title,
    dates: `${fmt(start)}/${fmt(end)}`,
  });

  if (props.location) params.set('location', props.location);
  if (props.description) params.set('details', props.description);

  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
}

function toOutlookUrl(props: AddToCalendarProps): string {
  const start = new Date(props.startTime);
  const end = new Date(start.getTime() + props.durationMins * 60 * 1000);

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: props.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });

  if (props.location) params.set('location', props.location);
  if (props.description) params.set('body', props.description);

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function generateIcsBlob(props: AddToCalendarProps): Blob {
  const start = new Date(props.startTime);
  const end = new Date(start.getTime() + props.durationMins * 60 * 1000);

  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BookingOS//EN',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${props.title}`,
  ];

  if (props.location) lines.push(`LOCATION:${props.location}`);
  if (props.description) lines.push(`DESCRIPTION:${props.description}`);

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
}

export function AddToCalendar(props: AddToCalendarProps) {
  const handleDownloadIcs = () => {
    const blob = generateIcsBlob(props);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'appointment.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap gap-2 justify-center" data-testid="add-to-calendar">
      <a
        href={toGoogleCalendarUrl(props)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        data-testid="add-to-google"
      >
        <Calendar size={12} />
        Google Calendar
      </a>
      <a
        href={toOutlookUrl(props)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        data-testid="add-to-outlook"
      >
        <Calendar size={12} />
        Outlook
      </a>
      <button
        onClick={handleDownloadIcs}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        data-testid="download-ics"
      >
        <Download size={12} />
        Download .ics
      </button>
    </div>
  );
}

// Export for testing
export { toGoogleCalendarUrl, toOutlookUrl, generateIcsBlob };

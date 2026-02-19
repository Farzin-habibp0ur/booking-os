import { render, screen, fireEvent } from '@testing-library/react';
import {
  AddToCalendar,
  toGoogleCalendarUrl,
  toOutlookUrl,
  generateIcsBlob,
} from './add-to-calendar';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const defaultProps = {
  title: 'Botox Treatment',
  startTime: '2026-03-15T14:00:00Z',
  durationMins: 60,
};

describe('AddToCalendar', () => {
  it('renders all three calendar buttons', () => {
    render(<AddToCalendar {...defaultProps} />);

    expect(screen.getByTestId('add-to-calendar')).toBeInTheDocument();
    expect(screen.getByTestId('add-to-google')).toBeInTheDocument();
    expect(screen.getByTestId('add-to-outlook')).toBeInTheDocument();
    expect(screen.getByTestId('download-ics')).toBeInTheDocument();
  });

  it('renders button labels', () => {
    render(<AddToCalendar {...defaultProps} />);

    expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    expect(screen.getByText('Outlook')).toBeInTheDocument();
    expect(screen.getByText('Download .ics')).toBeInTheDocument();
  });

  it('Google link opens in new tab', () => {
    render(<AddToCalendar {...defaultProps} />);

    const link = screen.getByTestId('add-to-google');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('Outlook link opens in new tab', () => {
    render(<AddToCalendar {...defaultProps} />);

    const link = screen.getByTestId('add-to-outlook');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('downloads .ics file on click', () => {
    render(<AddToCalendar {...defaultProps} />);

    const createObjectURL = jest.fn(() => 'blob:test');
    const revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const appendChild = jest.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
    const removeChild = jest.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

    fireEvent.click(screen.getByTestId('download-ics'));

    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');

    appendChild.mockRestore();
    removeChild.mockRestore();
  });
});

describe('toGoogleCalendarUrl', () => {
  it('generates correct Google Calendar URL', () => {
    const url = toGoogleCalendarUrl(defaultProps);

    expect(url).toContain('calendar.google.com/calendar/r/eventedit');
    expect(url).toContain('text=Botox+Treatment');
    expect(url).toContain('dates=');
    expect(url).toContain('20260315T140000Z');
    expect(url).toContain('20260315T150000Z');
  });

  it('includes location when provided', () => {
    const url = toGoogleCalendarUrl({ ...defaultProps, location: 'Glow Clinic' });

    expect(url).toContain('location=Glow+Clinic');
  });

  it('includes description when provided', () => {
    const url = toGoogleCalendarUrl({ ...defaultProps, description: 'First visit' });

    expect(url).toContain('details=First+visit');
  });
});

describe('toOutlookUrl', () => {
  it('generates correct Outlook URL', () => {
    const url = toOutlookUrl(defaultProps);

    expect(url).toContain('outlook.live.com/calendar/0/deeplink/compose');
    expect(url).toContain('subject=Botox+Treatment');
    expect(url).toContain('startdt=');
    expect(url).toContain('enddt=');
  });

  it('includes location when provided', () => {
    const url = toOutlookUrl({ ...defaultProps, location: 'Glow Clinic' });

    expect(url).toContain('location=Glow+Clinic');
  });
});

describe('generateIcsBlob', () => {
  function readBlob(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });
  }

  it('generates valid iCal content', async () => {
    const blob = generateIcsBlob(defaultProps);
    const text = await readBlob(blob);

    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('VERSION:2.0');
    expect(text).toContain('BEGIN:VEVENT');
    expect(text).toContain('SUMMARY:Botox Treatment');
    expect(text).toContain('DTSTART:20260315T140000Z');
    expect(text).toContain('DTEND:20260315T150000Z');
    expect(text).toContain('END:VEVENT');
    expect(text).toContain('END:VCALENDAR');
  });

  it('includes location in iCal when provided', async () => {
    const blob = generateIcsBlob({ ...defaultProps, location: 'Glow Clinic' });
    const text = await readBlob(blob);

    expect(text).toContain('LOCATION:Glow Clinic');
  });

  it('has correct MIME type', () => {
    const blob = generateIcsBlob(defaultProps);

    expect(blob.type).toBe('text/calendar;charset=utf-8');
  });
});

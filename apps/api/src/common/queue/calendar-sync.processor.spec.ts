import { CalendarSyncProcessor, CalendarSyncJobData } from './calendar-sync.processor';
import { Job } from 'bullmq';

describe('CalendarSyncProcessor', () => {
  let processor: CalendarSyncProcessor;

  const mockSyncBookingToCalendar = jest.fn();
  const mockFindUnique = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new CalendarSyncProcessor();

    (processor as any).moduleRef = {
      get: jest.fn((ServiceClass: any) => {
        if (ServiceClass.name === 'CalendarSyncService' || ServiceClass === undefined) {
          // Handle dynamic import — the class ref may not match by identity
          return { syncBookingToCalendar: mockSyncBookingToCalendar };
        }
        if (ServiceClass.name === 'PrismaService') {
          return { booking: { findUnique: mockFindUnique } };
        }
        return null;
      }),
    };
  });

  function createJob(data: Partial<CalendarSyncJobData> = {}): Job<CalendarSyncJobData> {
    return {
      id: 'job-1',
      data: {
        businessId: 'biz-1',
        bookingId: 'booking-1',
        staffId: 'staff-1',
        action: 'create',
        ...data,
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as any;
  }

  const mockBooking = {
    id: 'booking-1',
    staffId: 'staff-1',
    externalCalendarEventId: null,
    startTime: new Date('2026-03-24T10:00:00Z'),
    endTime: new Date('2026-03-24T11:00:00Z'),
    status: 'CONFIRMED',
    customer: { name: 'Jane Doe' },
    service: { name: 'Consultation' },
    staff: { name: 'Dr. Smith' },
  };

  it('should sync a booking to calendar on create', async () => {
    mockFindUnique.mockResolvedValue(mockBooking);
    mockSyncBookingToCalendar.mockResolvedValue(undefined);

    await processor.process(createJob());

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      include: { customer: true, service: true, staff: true },
    });
    expect(mockSyncBookingToCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'booking-1',
        staffId: 'staff-1',
        customer: { name: 'Jane Doe' },
        service: { name: 'Consultation' },
      }),
      'create',
    );
  });

  it('should skip processing when booking not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    await processor.process(createJob());

    expect(mockSyncBookingToCalendar).not.toHaveBeenCalled();
  });

  it('should throw when CalendarSyncService fails', async () => {
    mockFindUnique.mockResolvedValue(mockBooking);
    mockSyncBookingToCalendar.mockRejectedValue(new Error('Google API error'));

    await expect(processor.process(createJob())).rejects.toThrow('Google API error');
  });

  it('should handle cancel action', async () => {
    mockFindUnique.mockResolvedValue({
      ...mockBooking,
      externalCalendarEventId: 'ext-123',
      status: 'CANCELLED',
    });
    mockSyncBookingToCalendar.mockResolvedValue(undefined);

    await processor.process(createJob({ action: 'cancel' }));

    expect(mockSyncBookingToCalendar).toHaveBeenCalledWith(
      expect.objectContaining({ externalCalendarEventId: 'ext-123' }),
      'cancel',
    );
  });

  it('should log on job failure', async () => {
    const logSpy = jest.spyOn(processor['logger'], 'warn').mockImplementation();
    const job = createJob();

    await processor.onFailed(job, new Error('timeout'));

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Calendar sync job job-1 failed'));
  });
});

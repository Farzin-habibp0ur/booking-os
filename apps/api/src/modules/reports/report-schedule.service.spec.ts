import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { ReportScheduleService } from './report-schedule.service';
import { ReportsService } from './reports.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../../common/prisma.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';

describe('ReportScheduleService', () => {
  let service: ReportScheduleService;
  let prisma: any;
  let reportsService: any;
  let emailService: any;
  let mockQueue: any;

  const BID = 'biz-1';

  beforeEach(async () => {
    prisma = {
      reportSchedule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    reportsService = {
      bookingsOverTime: jest.fn().mockResolvedValue([{ date: '2027-01-01', count: 5 }]),
      revenueOverTime: jest.fn().mockResolvedValue([{ date: '2027-01-01', revenue: 100 }]),
      noShowRate: jest.fn().mockResolvedValue({ total: 10, noShows: 2, rate: 20 }),
      serviceBreakdown: jest.fn().mockResolvedValue([]),
      staffPerformance: jest.fn().mockResolvedValue([]),
      statusBreakdown: jest.fn().mockResolvedValue([]),
      peakHours: jest.fn().mockResolvedValue({ byHour: [], byDay: [] }),
      consultToTreatmentConversion: jest.fn().mockResolvedValue({ rate: 50 }),
    };

    emailService = {
      send: jest.fn().mockResolvedValue(true),
      buildBrandedHtml: jest.fn((html: string) => `<branded>${html}</branded>`),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportScheduleService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReportsService, useValue: reportsService },
        { provide: EmailService, useValue: emailService },
        { provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: mockQueue },
      ],
    }).compile();

    service = module.get(ReportScheduleService);
  });

  describe('create', () => {
    it('creates a report schedule', async () => {
      const dto = {
        reportType: 'bookings-over-time',
        frequency: 'WEEKLY',
        recipients: ['admin@test.com'],
        dayOfWeek: 1,
      };
      prisma.reportSchedule.create.mockResolvedValue({ id: 'rs-1', ...dto, businessId: BID });

      const result = await service.create(BID, dto);
      expect(prisma.reportSchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: BID,
          reportType: 'bookings-over-time',
          frequency: 'WEEKLY',
          recipients: ['admin@test.com'],
          dayOfWeek: 1,
          hour: 9,
          timezone: 'UTC',
        }),
      });
      expect(result.id).toBe('rs-1');
    });
  });

  describe('findAll', () => {
    it('returns schedules for business', async () => {
      prisma.reportSchedule.findMany.mockResolvedValue([{ id: 'rs-1' }, { id: 'rs-2' }]);

      const result = await service.findAll(BID);
      expect(prisma.reportSchedule.findMany).toHaveBeenCalledWith({
        where: { businessId: BID },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('updates schedule fields', async () => {
      prisma.reportSchedule.findFirst.mockResolvedValue({ id: 'rs-1', businessId: BID });
      prisma.reportSchedule.update.mockResolvedValue({ id: 'rs-1', frequency: 'DAILY' });

      const result = await service.update(BID, 'rs-1', { frequency: 'DAILY' });
      expect(prisma.reportSchedule.update).toHaveBeenCalledWith({
        where: { id: 'rs-1' },
        data: { frequency: 'DAILY' },
      });
      expect(result.frequency).toBe('DAILY');
    });

    it('throws NotFoundException if not found', async () => {
      prisma.reportSchedule.findFirst.mockResolvedValue(null);
      await expect(service.update(BID, 'nonexistent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes schedule', async () => {
      prisma.reportSchedule.findFirst.mockResolvedValue({ id: 'rs-1', businessId: BID });
      prisma.reportSchedule.delete.mockResolvedValue({ id: 'rs-1' });

      await service.remove(BID, 'rs-1');
      expect(prisma.reportSchedule.delete).toHaveBeenCalledWith({ where: { id: 'rs-1' } });
    });

    it('throws NotFoundException if not found', async () => {
      prisma.reportSchedule.findFirst.mockResolvedValue(null);
      await expect(service.remove(BID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findDueSchedules', () => {
    it('returns daily schedules matching current hour', async () => {
      const now = new Date();
      prisma.reportSchedule.findMany.mockResolvedValue([
        {
          id: 'rs-1',
          frequency: 'DAILY',
          dayOfWeek: null,
          dayOfMonth: null,
          lastSentAt: null,
          business: { name: 'Test' },
        },
      ]);

      const result = await service.findDueSchedules();
      expect(result).toHaveLength(1);
    });

    it('filters weekly schedules by dayOfWeek', async () => {
      const now = new Date();
      const wrongDay = (now.getUTCDay() + 3) % 7;
      prisma.reportSchedule.findMany.mockResolvedValue([
        {
          id: 'rs-1',
          frequency: 'WEEKLY',
          dayOfWeek: wrongDay,
          dayOfMonth: null,
          lastSentAt: null,
          business: { name: 'Test' },
        },
      ]);

      const result = await service.findDueSchedules();
      expect(result).toHaveLength(0);
    });

    it('skips recently sent schedules', async () => {
      prisma.reportSchedule.findMany.mockResolvedValue([
        {
          id: 'rs-1',
          frequency: 'DAILY',
          dayOfWeek: null,
          dayOfMonth: null,
          lastSentAt: new Date(), // just sent
          business: { name: 'Test' },
        },
      ]);

      const result = await service.findDueSchedules();
      expect(result).toHaveLength(0);
    });
  });

  describe('processScheduledReports', () => {
    it('enqueues due schedules to notification queue', async () => {
      prisma.reportSchedule.findMany.mockResolvedValue([
        {
          id: 'rs-1',
          businessId: BID,
          frequency: 'DAILY',
          dayOfWeek: null,
          dayOfMonth: null,
          lastSentAt: null,
          reportType: 'bookings-over-time',
          recipients: ['admin@test.com'],
          business: { name: 'Test Clinic' },
        },
      ]);

      await service.processScheduledReports();
      expect(mockQueue.add).toHaveBeenCalledWith('report-email', {
        scheduleId: 'rs-1',
        businessId: BID,
        reportType: 'bookings-over-time',
        recipients: ['admin@test.com'],
        businessName: 'Test Clinic',
      });
    });
  });

  describe('sendReportEmail', () => {
    it('fetches report data and sends email to all recipients', async () => {
      const schedule = {
        id: 'rs-1',
        businessId: BID,
        reportType: 'no-show-rate',
        recipients: ['admin@test.com', 'manager@test.com'],
        business: { name: 'Test Clinic' },
      };

      await service.sendReportEmail(schedule);

      expect(reportsService.noShowRate).toHaveBeenCalledWith(BID, 30);
      expect(emailService.send).toHaveBeenCalledTimes(2);
      expect(emailService.buildBrandedHtml).toHaveBeenCalled();
      expect(prisma.reportSchedule.update).toHaveBeenCalledWith({
        where: { id: 'rs-1' },
        data: { lastSentAt: expect.any(Date) },
      });
    });

    it('handles array report data (bookings-over-time)', async () => {
      const schedule = {
        id: 'rs-2',
        businessId: BID,
        reportType: 'bookings-over-time',
        recipients: ['admin@test.com'],
        business: { name: 'Test Clinic' },
      };

      await service.sendReportEmail(schedule);

      expect(reportsService.bookingsOverTime).toHaveBeenCalledWith(BID, 30);
      expect(emailService.send).toHaveBeenCalledTimes(1);
    });
  });
});

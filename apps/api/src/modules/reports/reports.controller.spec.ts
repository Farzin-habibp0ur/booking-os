import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportScheduleService } from './report-schedule.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let reportsService: any;
  let scheduleService: any;

  const BID = 'biz-1';

  beforeEach(async () => {
    reportsService = {
      bookingsOverTime: jest.fn().mockResolvedValue([]),
      noShowRate: jest.fn().mockResolvedValue({ rate: 10 }),
      responseTimes: jest.fn().mockResolvedValue({ avgMinutes: 5 }),
      serviceBreakdown: jest.fn().mockResolvedValue([]),
      staffPerformance: jest.fn().mockResolvedValue([]),
      revenueOverTime: jest.fn().mockResolvedValue([]),
      statusBreakdown: jest.fn().mockResolvedValue([]),
      peakHours: jest.fn().mockResolvedValue({ byHour: [], byDay: [] }),
      consultToTreatmentConversion: jest.fn().mockResolvedValue({ rate: 50 }),
    };

    scheduleService = {
      create: jest.fn().mockResolvedValue({ id: 'rs-1' }),
      findAll: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'rs-1' }),
      remove: jest.fn().mockResolvedValue({ id: 'rs-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: ReportScheduleService, useValue: scheduleService },
      ],
    }).compile();

    controller = module.get(ReportsController);
  });

  describe('existing report endpoints', () => {
    it('bookingsOverTime calls service', async () => {
      await controller.bookingsOverTime(BID, '7');
      expect(reportsService.bookingsOverTime).toHaveBeenCalledWith(BID, 7);
    });

    it('noShowRate calls service with default days', async () => {
      await controller.noShowRate(BID);
      expect(reportsService.noShowRate).toHaveBeenCalledWith(BID, undefined);
    });
  });

  describe('schedule endpoints', () => {
    it('POST /schedules creates schedule', async () => {
      const dto = {
        reportType: 'bookings-over-time',
        frequency: 'WEEKLY',
        recipients: ['a@b.com'],
      };
      const result = await controller.createSchedule(BID, dto as any);
      expect(scheduleService.create).toHaveBeenCalledWith(BID, dto);
      expect(result.id).toBe('rs-1');
    });

    it('GET /schedules lists schedules', async () => {
      await controller.listSchedules(BID);
      expect(scheduleService.findAll).toHaveBeenCalledWith(BID);
    });

    it('PATCH /schedules/:id updates schedule', async () => {
      const dto = { frequency: 'DAILY' };
      await controller.updateSchedule(BID, 'rs-1', dto as any);
      expect(scheduleService.update).toHaveBeenCalledWith(BID, 'rs-1', dto);
    });

    it('DELETE /schedules/:id removes schedule', async () => {
      await controller.deleteSchedule(BID, 'rs-1');
      expect(scheduleService.remove).toHaveBeenCalledWith(BID, 'rs-1');
    });
  });
});

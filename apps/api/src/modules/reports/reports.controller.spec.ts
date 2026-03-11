import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportScheduleService } from './report-schedule.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: any;
  let scheduleService: any;

  const BID = 'biz-1';

  beforeEach(async () => {
    service = {
      bookingsOverTime: jest.fn().mockResolvedValue([{ date: '2026-03-01', count: 5 }]),
      revenueOverTime: jest.fn().mockResolvedValue([{ date: '2026-03-01', revenue: 500 }]),
      noShowRate: jest.fn().mockResolvedValue({ total: 10, noShows: 1, rate: 10 }),
      responseTimes: jest.fn().mockResolvedValue({ avgMinutes: 5, sampleSize: 10 }),
      serviceBreakdown: jest.fn().mockResolvedValue([{ name: 'Consult', count: 5, revenue: 500 }]),
      staffPerformance: jest.fn().mockResolvedValue([{ name: 'Dr. Smith', total: 5 }]),
      statusBreakdown: jest.fn().mockResolvedValue([{ status: 'COMPLETED', count: 5 }]),
      peakHours: jest.fn().mockResolvedValue({ byHour: [], byDay: [] }),
      consultToTreatmentConversion: jest.fn().mockResolvedValue({ rate: 50 }),
      sourceBreakdown: jest.fn().mockResolvedValue([{ source: 'MANUAL', count: 5 }]),
      revenueSummary: jest.fn().mockResolvedValue({ totalRevenue: 1000, bookingCount: 10 }),
      staffUtilization: jest.fn().mockResolvedValue([{ name: 'Dr. Smith', utilization: 75 }]),
      clientMetrics: jest.fn().mockResolvedValue({ newCustomers: 5, returningCustomers: 3 }),
      communicationMetrics: jest.fn().mockResolvedValue({ avgResponseMinutes: 5, slaRate: 90 }),
    };

    scheduleService = {
      create: jest.fn().mockResolvedValue({ id: 'rs-1' }),
      findAll: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'rs-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: service },
        { provide: ReportScheduleService, useValue: scheduleService },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  // ─── Existing Report Endpoints ───────────────────────────────────

  it('should get bookings over time', async () => {
    const result = await controller.bookingsOverTime(BID);
    expect(service.bookingsOverTime).toHaveBeenCalledWith(BID, undefined, undefined, undefined);
    expect(result).toHaveLength(1);
  });

  it('should get bookings over time with date range', async () => {
    await controller.bookingsOverTime(BID, undefined, '2026-03-01', '2026-03-31');
    expect(service.bookingsOverTime).toHaveBeenCalledWith(BID, undefined, expect.any(Date), expect.any(Date));
  });

  it('should get no-show rate', async () => {
    const result = await controller.noShowRate(BID);
    expect(service.noShowRate).toHaveBeenCalledWith(BID, undefined, undefined, undefined);
    expect(result.rate).toBe(10);
  });

  it('should get service breakdown', async () => {
    const result = await controller.serviceBreakdown(BID);
    expect(service.serviceBreakdown).toHaveBeenCalledWith(BID, undefined, undefined, undefined);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Consult');
  });

  it('should get staff performance', async () => {
    const result = await controller.staffPerformance(BID);
    expect(service.staffPerformance).toHaveBeenCalledWith(BID, undefined, undefined, undefined);
    expect(result).toHaveLength(1);
  });

  it('should get peak hours', async () => {
    const result = await controller.peakHours(BID);
    expect(service.peakHours).toHaveBeenCalledWith(BID, undefined, undefined, undefined);
    expect(result.byHour).toEqual([]);
  });

  it('should get consult conversion', async () => {
    const result = await controller.consultConversion(BID);
    expect(service.consultToTreatmentConversion).toHaveBeenCalledWith(BID, undefined, undefined, undefined);
    expect(result.rate).toBe(50);
  });

  it('should get source breakdown', async () => {
    const result = await controller.sourceBreakdown(BID);
    expect(service.sourceBreakdown).toHaveBeenCalledWith(BID, undefined, undefined, undefined);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('MANUAL');
  });

  // ─── New Report Endpoints ────────────────────────────────────────

  it('should get revenue summary', async () => {
    const result = await controller.revenueSummary(BID);
    expect(service.revenueSummary).toHaveBeenCalledWith(BID, undefined, undefined, undefined, undefined);
    expect(result.totalRevenue).toBe(1000);
  });

  it('should get revenue summary with staff filter', async () => {
    await controller.revenueSummary(BID, undefined, undefined, undefined, 'staff1');
    expect(service.revenueSummary).toHaveBeenCalledWith(BID, undefined, undefined, undefined, 'staff1');
  });

  it('should get staff utilization', async () => {
    const result = await controller.staffUtilization(BID);
    expect(service.staffUtilization).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].utilization).toBe(75);
  });

  it('should get client metrics', async () => {
    const result = await controller.clientMetrics(BID);
    expect(service.clientMetrics).toHaveBeenCalled();
    expect(result.newCustomers).toBe(5);
  });

  it('should get communication metrics', async () => {
    const result = await controller.communicationMetrics(BID);
    expect(service.communicationMetrics).toHaveBeenCalled();
    expect(result.slaRate).toBe(90);
  });

  // ─── Report Schedule Endpoints ───────────────────────────────────

  it('should create a report schedule', async () => {
    const dto = { reportType: 'bookings-over-time', frequency: 'WEEKLY', recipients: ['a@b.com'] } as any;
    const result = await controller.createSchedule(BID, dto);
    expect(scheduleService.create).toHaveBeenCalledWith(BID, dto);
    expect(result.id).toBe('rs-1');
  });

  it('should list report schedules', async () => {
    const result = await controller.listSchedules(BID);
    expect(scheduleService.findAll).toHaveBeenCalledWith(BID);
    expect(result).toEqual([]);
  });

  it('should update a report schedule', async () => {
    const dto = { frequency: 'DAILY' } as any;
    const result = await controller.updateSchedule(BID, 'rs-1', dto);
    expect(scheduleService.update).toHaveBeenCalledWith(BID, 'rs-1', dto);
    expect(result.id).toBe('rs-1');
  });

  it('should delete a report schedule', async () => {
    await controller.deleteSchedule(BID, 'rs-1');
    expect(scheduleService.remove).toHaveBeenCalledWith(BID, 'rs-1');
  });
});

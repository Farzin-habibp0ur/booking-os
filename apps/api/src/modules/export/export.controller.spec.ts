import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { ReportsService } from '../reports/reports.service';
import { BadRequestException } from '@nestjs/common';

describe('ExportController', () => {
  let controller: ExportController;
  let mockService: Record<string, jest.Mock>;
  let mockReportsService: Record<string, jest.Mock>;
  let mockRes: { setHeader: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    mockService = {
      exportCustomersCsv: jest.fn().mockResolvedValue('id,name\r\nc1,Jane\r\n'),
      exportBookingsCsv: jest.fn().mockResolvedValue('id,status\r\nb1,CONFIRMED\r\n'),
      exportReportCsv: jest.fn().mockReturnValue('Date,Count\r\n2026-03-01,5\r\n'),
      exportReportPdf: jest.fn().mockReturnValue('<!DOCTYPE html><html><body>report</body></html>'),
    };
    mockReportsService = {
      bookingsOverTime: jest.fn().mockResolvedValue([{ date: '2026-03-01', count: 5 }]),
      revenueOverTime: jest.fn().mockResolvedValue([{ date: '2026-03-01', revenue: 500 }]),
      noShowRate: jest.fn().mockResolvedValue({ total: 10, noShows: 2, rate: 20 }),
      responseTimes: jest.fn().mockResolvedValue({ avgMinutes: 5, sampleSize: 10 }),
      serviceBreakdown: jest.fn().mockResolvedValue([{ name: 'Botox', count: 3, revenue: 600 }]),
      staffPerformance: jest.fn().mockResolvedValue([]),
      statusBreakdown: jest.fn().mockResolvedValue([{ status: 'COMPLETED', count: 5 }]),
      peakHours: jest.fn().mockResolvedValue({ byHour: [], byDay: [] }),
      consultToTreatmentConversion: jest
        .fn()
        .mockResolvedValue({ consultCustomers: 10, converted: 5, rate: 50 }),
      depositComplianceRate: jest.fn().mockResolvedValue({ totalRequired: 8, paid: 6, rate: 75 }),
    };
    mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    controller = new ExportController(
      mockService as unknown as ExportService,
      mockReportsService as unknown as ReportsService,
    );
  });

  describe('exportCustomers', () => {
    it('sets CSV content-type and disposition headers', async () => {
      await controller.exportCustomers('biz1', undefined, undefined, undefined, mockRes as any);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('customers-'),
      );
    });

    it('sends CSV content in response', async () => {
      await controller.exportCustomers('biz1', undefined, undefined, undefined, mockRes as any);

      expect(mockRes.send).toHaveBeenCalledWith('id,name\r\nc1,Jane\r\n');
    });

    it('passes date range and fields to service', async () => {
      await controller.exportCustomers(
        'biz1',
        '2026-01-01',
        '2026-01-31',
        'name,email',
        mockRes as any,
      );

      expect(mockService.exportCustomersCsv).toHaveBeenCalledWith('biz1', {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        fields: ['name', 'email'],
      });
    });
  });

  describe('exportBookings', () => {
    it('sets CSV content-type and disposition headers', async () => {
      await controller.exportBookings('biz1', undefined, undefined, undefined, mockRes as any);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('bookings-'),
      );
    });

    it('sends CSV content in response', async () => {
      await controller.exportBookings('biz1', undefined, undefined, undefined, mockRes as any);

      expect(mockRes.send).toHaveBeenCalledWith('id,status\r\nb1,CONFIRMED\r\n');
    });

    it('passes date range and fields to service', async () => {
      await controller.exportBookings(
        'biz1',
        '2026-03-01',
        '2026-03-31',
        'customerName,status',
        mockRes as any,
      );

      expect(mockService.exportBookingsCsv).toHaveBeenCalledWith('biz1', {
        dateFrom: '2026-03-01',
        dateTo: '2026-03-31',
        fields: ['customerName', 'status'],
      });
    });
  });

  describe('exportReport', () => {
    it('exports bookings-over-time report as CSV', async () => {
      await controller.exportReport('biz1', 'bookings-over-time', '30', undefined, mockRes as any);

      expect(mockReportsService.bookingsOverTime).toHaveBeenCalledWith('biz1', 30);
      expect(mockService.exportReportCsv).toHaveBeenCalledWith('bookings-over-time', [
        { date: '2026-03-01', count: 5 },
      ]);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('bookings-over-time-'),
      );
    });

    it('exports report as PDF (HTML) when format=pdf', async () => {
      await controller.exportReport('biz1', 'service-breakdown', '30', 'pdf', mockRes as any);

      expect(mockReportsService.serviceBreakdown).toHaveBeenCalledWith('biz1', 30);
      expect(mockService.exportReportPdf).toHaveBeenCalledWith('service-breakdown', [
        { name: 'Botox', count: 3, revenue: 600 },
      ]);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.html'),
      );
    });

    it('throws BadRequestException for invalid report type', async () => {
      await expect(
        controller.exportReport('biz1', 'invalid-report', '30', undefined, mockRes as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults to 30 days when no days param', async () => {
      await controller.exportReport(
        'biz1',
        'revenue-over-time',
        undefined,
        undefined,
        mockRes as any,
      );

      expect(mockReportsService.revenueOverTime).toHaveBeenCalledWith('biz1', 30);
    });

    it('defaults to CSV format when format is not pdf', async () => {
      await controller.exportReport('biz1', 'no-show-rate', '30', undefined, mockRes as any);

      expect(mockService.exportReportCsv).toHaveBeenCalled();
      expect(mockService.exportReportPdf).not.toHaveBeenCalled();
    });

    it('routes response-times to correct service method', async () => {
      await controller.exportReport('biz1', 'response-times', '30', undefined, mockRes as any);

      expect(mockReportsService.responseTimes).toHaveBeenCalledWith('biz1');
    });

    it('routes staff-performance to correct service method', async () => {
      await controller.exportReport('biz1', 'staff-performance', '60', undefined, mockRes as any);

      expect(mockReportsService.staffPerformance).toHaveBeenCalledWith('biz1', 60);
    });

    it('routes status-breakdown to correct service method', async () => {
      await controller.exportReport('biz1', 'status-breakdown', '7', undefined, mockRes as any);

      expect(mockReportsService.statusBreakdown).toHaveBeenCalledWith('biz1', 7);
    });

    it('routes peak-hours to correct service method', async () => {
      await controller.exportReport('biz1', 'peak-hours', '30', undefined, mockRes as any);

      expect(mockReportsService.peakHours).toHaveBeenCalledWith('biz1', 30);
    });

    it('routes consult-conversion to correct service method', async () => {
      await controller.exportReport('biz1', 'consult-conversion', '90', undefined, mockRes as any);

      expect(mockReportsService.consultToTreatmentConversion).toHaveBeenCalledWith('biz1', 90);
    });

    it('routes deposit-compliance to correct service method', async () => {
      await controller.exportReport('biz1', 'deposit-compliance', '30', undefined, mockRes as any);

      expect(mockReportsService.depositComplianceRate).toHaveBeenCalledWith('biz1');
    });
  });
});

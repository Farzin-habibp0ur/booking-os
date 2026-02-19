import { ExportController } from './export.controller';
import { ExportService } from './export.service';

describe('ExportController', () => {
  let controller: ExportController;
  let mockService: Record<string, jest.Mock>;
  let mockRes: { setHeader: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    mockService = {
      exportCustomersCsv: jest.fn().mockResolvedValue('id,name\r\nc1,Jane\r\n'),
      exportBookingsCsv: jest.fn().mockResolvedValue('id,status\r\nb1,CONFIRMED\r\n'),
    };
    mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    controller = new ExportController(mockService as unknown as ExportService);
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
});

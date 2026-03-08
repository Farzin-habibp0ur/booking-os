import { Test } from '@nestjs/testing';
import { ExportService } from './export.service';
import { PrismaService } from '../../common/prisma.service';
import { ActionHistoryService } from '../action-history/action-history.service';
import { createMockPrisma, createMockActionHistoryService } from '../../test/mocks';

describe('ExportService', () => {
  let service: ExportService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let actionHistoryService: ReturnType<typeof createMockActionHistoryService>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    actionHistoryService = createMockActionHistoryService();

    const module = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActionHistoryService, useValue: actionHistoryService },
      ],
    }).compile();

    service = module.get(ExportService);
  });

  describe('exportCustomersCsv', () => {
    it('generates CSV with header row and customer data', async () => {
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Jane Doe',
          phone: '+1234567890',
          email: 'jane@test.com',
          tags: ['VIP', 'Regular'],
          createdAt: new Date('2026-01-15T10:00:00Z'),
          updatedAt: new Date('2026-01-20T10:00:00Z'),
        },
      ] as any);

      const csv = await service.exportCustomersCsv('biz1');

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe('id,name,phone,email,tags,createdAt,updatedAt');
      expect(lines[1]).toContain('Jane Doe');
      expect(lines[1]).toContain('VIP; Regular');
      expect(lines[1]).toContain('jane@test.com');
    });

    it('filters by businessId', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.exportCustomersCsv('biz1');

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1' },
        }),
      );
    });

    it('applies date range filter', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.exportCustomersCsv('biz1', {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            },
          }),
        }),
      );
    });

    it('respects field selection', async () => {
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Jane',
          phone: '+1234567890',
          email: 'jane@test.com',
          tags: [],
          createdAt: new Date('2026-01-15'),
          updatedAt: new Date('2026-01-20'),
        },
      ] as any);

      const csv = await service.exportCustomersCsv('biz1', {
        fields: ['name', 'email'],
      });

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe('name,email');
      expect(lines[1]).toBe('Jane,jane@test.com');
    });

    it('limits to 10000 rows', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.exportCustomersCsv('biz1');

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10000 }),
      );
    });

    it('escapes CSV fields with commas and quotes', async () => {
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Doe, Jane "JD"',
          phone: '+1234567890',
          email: null,
          tags: [],
          createdAt: new Date('2026-01-15'),
          updatedAt: new Date('2026-01-20'),
        },
      ] as any);

      const csv = await service.exportCustomersCsv('biz1');

      const lines = csv.trim().split('\r\n');
      // Name should be escaped with double quotes
      expect(lines[1]).toContain('"Doe, Jane ""JD"""');
    });

    it('handles empty tags array', async () => {
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Jane',
          phone: '+1',
          email: null,
          tags: [],
          createdAt: new Date('2026-01-15'),
          updatedAt: new Date('2026-01-15'),
        },
      ] as any);

      const csv = await service.exportCustomersCsv('biz1');

      const lines = csv.trim().split('\r\n');
      // tags field should be empty
      expect(lines[1]).toContain('c1,Jane,+1,,');
    });

    it('returns header-only CSV when no customers exist', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      const csv = await service.exportCustomersCsv('biz1');

      const lines = csv.trim().split('\r\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('id,name,phone,email,tags,createdAt,updatedAt');
    });
  });

  describe('exportBookingsCsv', () => {
    it('generates CSV with header row and booking data', async () => {
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 'b1',
          status: 'CONFIRMED',
          startTime: new Date('2026-03-01T10:00:00Z'),
          endTime: new Date('2026-03-01T11:00:00Z'),
          notes: 'First visit',
          createdAt: new Date('2026-02-15T10:00:00Z'),
          customer: { name: 'Jane Doe', phone: '+1234567890', email: 'jane@test.com' },
          service: { name: 'Botox' },
          staff: { name: 'Sarah Johnson' },
        },
      ] as any);

      const csv = await service.exportBookingsCsv('biz1');

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe(
        'id,customerName,customerPhone,customerEmail,serviceName,staffName,status,startTime,endTime,notes,createdAt',
      );
      expect(lines[1]).toContain('Jane Doe');
      expect(lines[1]).toContain('Botox');
      expect(lines[1]).toContain('Sarah Johnson');
      expect(lines[1]).toContain('CONFIRMED');
    });

    it('applies date range filter on startTime', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await service.exportBookingsCsv('biz1', {
        dateFrom: '2026-03-01',
        dateTo: '2026-03-31',
      });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: {
              gte: new Date('2026-03-01'),
              lte: new Date('2026-03-31'),
            },
          }),
        }),
      );
    });

    it('includes customer, service, staff relations', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await service.exportBookingsCsv('biz1');

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { customer: true, service: true, staff: true },
        }),
      );
    });

    it('respects field selection for bookings', async () => {
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 'b1',
          status: 'CONFIRMED',
          startTime: new Date('2026-03-01T10:00:00Z'),
          endTime: new Date('2026-03-01T11:00:00Z'),
          notes: '',
          createdAt: new Date('2026-02-15'),
          customer: { name: 'Jane', phone: '+1', email: null },
          service: { name: 'Botox' },
          staff: { name: 'Sarah' },
        },
      ] as any);

      const csv = await service.exportBookingsCsv('biz1', {
        fields: ['customerName', 'status'],
      });

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe('customerName,status');
      expect(lines[1]).toBe('Jane,CONFIRMED');
    });

    it('handles null staff and notes', async () => {
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 'b1',
          status: 'PENDING',
          startTime: new Date('2026-03-01T10:00:00Z'),
          endTime: new Date('2026-03-01T11:00:00Z'),
          notes: null,
          createdAt: new Date('2026-02-15'),
          customer: { name: 'Jane', phone: '+1', email: null },
          service: { name: 'Botox' },
          staff: null,
        },
      ] as any);

      const csv = await service.exportBookingsCsv('biz1');

      const lines = csv.trim().split('\r\n');
      expect(lines[1]).toContain('b1');
      // staff name should be empty
      expect(lines[1]).toContain(',,PENDING');
    });

    it('limits to 10000 rows', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await service.exportBookingsCsv('biz1');

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10000 }),
      );
    });

    it('returns header-only CSV when no bookings exist', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      const csv = await service.exportBookingsCsv('biz1');

      const lines = csv.trim().split('\r\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe(
        'id,customerName,customerPhone,customerEmail,serviceName,staffName,status,startTime,endTime,notes,createdAt',
      );
    });

    it('uses RFC 4180 line endings (CRLF)', async () => {
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 'b1',
          status: 'CONFIRMED',
          startTime: new Date('2026-03-01T10:00:00Z'),
          endTime: new Date('2026-03-01T11:00:00Z'),
          notes: '',
          createdAt: new Date('2026-02-15'),
          customer: { name: 'Jane', phone: '+1', email: null },
          service: { name: 'Botox' },
          staff: { name: 'Sarah' },
        },
      ] as any);

      const csv = await service.exportBookingsCsv('biz1');

      // Should contain CRLF line endings
      expect(csv).toContain('\r\n');
      // Should end with CRLF
      expect(csv.endsWith('\r\n')).toBe(true);
    });
  });

  describe('exportReportCsv', () => {
    it('generates CSV for array-based report data', () => {
      const data = [
        { date: '2026-03-01', count: 5 },
        { date: '2026-03-02', count: 10 },
      ];

      const csv = service.exportReportCsv('bookings-over-time', data);

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe('Date,Count');
      expect(lines[1]).toBe('2026-03-01,5');
      expect(lines[2]).toBe('2026-03-02,10');
    });

    it('generates CSV for single-object report data', () => {
      const data = { total: 20, noShows: 5, rate: 25 };

      const csv = service.exportReportCsv('no-show-rate', data);

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe('Total Bookings,No-Shows,Rate (%)');
      expect(lines[1]).toBe('20,5,25');
    });

    it('generates CSV for peak-hours using byHour array', () => {
      const data = {
        byHour: [
          { hour: 9, count: 3 },
          { hour: 10, count: 7 },
        ],
        byDay: [],
      };

      const csv = service.exportReportCsv('peak-hours', data);

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe('Hour,Count');
      expect(lines[1]).toBe('9,3');
      expect(lines[2]).toBe('10,7');
    });

    it('generates CSV for staff-performance report', () => {
      const data = [
        { name: 'Dr. Chen', total: 10, completed: 8, noShows: 1, noShowRate: 10, revenue: 2000 },
      ];

      const csv = service.exportReportCsv('staff-performance', data);

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe('Staff,Total Bookings,Completed,No-Shows,No-Show Rate (%),Revenue');
      expect(lines[1]).toBe('Dr. Chen,10,8,1,10,2000');
    });

    it('generates CSV for service-breakdown report', () => {
      const data = [
        { name: 'Botox', count: 5, revenue: 1000 },
        { name: 'Filler', count: 3, revenue: 900 },
      ];

      const csv = service.exportReportCsv('service-breakdown', data);

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe('Service,Bookings,Revenue');
      expect(lines[1]).toBe('Botox,5,1000');
      expect(lines[2]).toBe('Filler,3,900');
    });

    it('generates CSV for response-times report', () => {
      const data = { avgMinutes: 12, sampleSize: 50 };

      const csv = service.exportReportCsv('response-times', data);

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe('Avg Response (min),Sample Size');
      expect(lines[1]).toBe('12,50');
    });

    it('generates CSV for revenue-over-time report', () => {
      const data = [
        { date: '2026-03-01', revenue: 500 },
        { date: '2026-03-02', revenue: 750 },
      ];

      const csv = service.exportReportCsv('revenue-over-time', data);

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe('Date,Revenue');
      expect(lines[1]).toBe('2026-03-01,500');
    });

    it('generates CSV for status-breakdown report', () => {
      const data = [
        { status: 'COMPLETED', count: 10 },
        { status: 'CANCELLED', count: 2 },
      ];

      const csv = service.exportReportCsv('status-breakdown', data);

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe('Status,Count');
      expect(lines[1]).toBe('COMPLETED,10');
    });

    it('generates CSV for consult-conversion report', () => {
      const data = { consultCustomers: 20, converted: 12, rate: 60 };

      const csv = service.exportReportCsv('consult-conversion', data);

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe('Consult Customers,Converted,Rate (%)');
      expect(lines[1]).toBe('20,12,60');
    });

    it('generates CSV for deposit-compliance report', () => {
      const data = { totalRequired: 15, paid: 12, rate: 80 };

      const csv = service.exportReportCsv('deposit-compliance', data);

      const lines = csv.trim().split('\r\n');
      expect(lines[0]).toBe('Total Required,Paid,Rate (%)');
      expect(lines[1]).toBe('15,12,80');
    });

    it('throws error for unknown report type', () => {
      expect(() => service.exportReportCsv('invalid' as any, [])).toThrow(
        'Unknown report type: invalid',
      );
    });

    it('returns header-only CSV when data is empty array', () => {
      const csv = service.exportReportCsv('bookings-over-time', []);

      const lines = csv.trim().split('\r\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('Date,Count');
    });

    it('handles peak-hours with empty byHour array', () => {
      const csv = service.exportReportCsv('peak-hours', { byHour: [], byDay: [] });

      const lines = csv.trim().split('\r\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('Hour,Count');
    });

    it('uses RFC 4180 line endings (CRLF)', () => {
      const csv = service.exportReportCsv('bookings-over-time', [
        { date: '2026-03-01', count: 1 },
      ]);

      expect(csv).toContain('\r\n');
      expect(csv.endsWith('\r\n')).toBe(true);
    });
  });

  describe('exportReportPdf', () => {
    it('generates HTML document with table for array data', () => {
      const data = [
        { date: '2026-03-01', count: 5 },
        { date: '2026-03-02', count: 10 },
      ];

      const html = service.exportReportPdf('bookings-over-time', data);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Bookings Over Time</title>');
      expect(html).toContain('<th>Date</th>');
      expect(html).toContain('<th>Count</th>');
      expect(html).toContain('<td>2026-03-01</td>');
      expect(html).toContain('<td>5</td>');
      expect(html).toContain('<td>2026-03-02</td>');
      expect(html).toContain('<td>10</td>');
    });

    it('generates HTML document for single-object data', () => {
      const data = { total: 20, noShows: 5, rate: 25 };

      const html = service.exportReportPdf('no-show-rate', data);

      expect(html).toContain('<title>No-Show Rate</title>');
      expect(html).toContain('<td>20</td>');
      expect(html).toContain('<td>5</td>');
      expect(html).toContain('<td>25</td>');
    });

    it('generates HTML for peak-hours using byHour array', () => {
      const data = {
        byHour: [{ hour: 10, count: 7 }],
        byDay: [{ day: 1, count: 3 }],
      };

      const html = service.exportReportPdf('peak-hours', data);

      expect(html).toContain('<title>Peak Hours</title>');
      expect(html).toContain('<td>10</td>');
      expect(html).toContain('<td>7</td>');
    });

    it('escapes HTML special characters', () => {
      const data = [{ name: '<script>alert("xss")</script>', count: 1, revenue: 100 }];

      const html = service.exportReportPdf('service-breakdown', data);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('includes print-friendly CSS', () => {
      const html = service.exportReportPdf('bookings-over-time', []);

      expect(html).toContain('@media print');
      expect(html).toContain('print-color-adjust');
    });

    it('includes generation date', () => {
      const today = new Date().toISOString().split('T')[0];
      const html = service.exportReportPdf('bookings-over-time', []);

      expect(html).toContain(`Generated ${today}`);
    });

    it('throws error for unknown report type', () => {
      expect(() => service.exportReportPdf('invalid' as any, [])).toThrow(
        'Unknown report type: invalid',
      );
    });

    it('generates correct title for staff-performance', () => {
      const html = service.exportReportPdf('staff-performance', []);

      expect(html).toContain('<title>Staff Performance</title>');
    });

    it('generates correct title for consult-conversion', () => {
      const html = service.exportReportPdf('consult-conversion', {
        consultCustomers: 10,
        converted: 5,
        rate: 50,
      });

      expect(html).toContain('<title>Consult to Treatment Conversion</title>');
    });

    it('generates correct title for deposit-compliance', () => {
      const html = service.exportReportPdf('deposit-compliance', {
        totalRequired: 8,
        paid: 6,
        rate: 75,
      });

      expect(html).toContain('<title>Deposit Compliance</title>');
    });
  });

  describe('ActionHistory logging', () => {
    it('logs customer export to ActionHistory', async () => {
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Jane',
          phone: '+1',
          email: null,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      await service.exportCustomersCsv('biz1');

      expect(actionHistoryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz1',
          action: 'CSV_EXPORT',
          entityType: 'CUSTOMER',
          description: expect.stringContaining('1 customers'),
        }),
      );
    });

    it('logs booking export to ActionHistory', async () => {
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 'b1',
          status: 'CONFIRMED',
          startTime: new Date('2026-03-01T10:00:00Z'),
          endTime: new Date('2026-03-01T11:00:00Z'),
          notes: '',
          createdAt: new Date(),
          customer: { name: 'Jane', phone: '+1', email: null },
          service: { name: 'Botox' },
          staff: { name: 'Sarah' },
        },
      ] as any);

      await service.exportBookingsCsv('biz1');

      expect(actionHistoryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz1',
          action: 'CSV_EXPORT',
          entityType: 'BOOKING',
          description: expect.stringContaining('1 bookings'),
        }),
      );
    });

    it('includes metadata with row count and filters', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.exportCustomersCsv('biz1', {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        fields: ['name', 'email'],
      });

      expect(actionHistoryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            rowCount: 0,
            fields: ['name', 'email'],
            dateFrom: '2026-01-01',
            dateTo: '2026-01-31',
          }),
        }),
      );
    });

    it('does not fail export if ActionHistory logging fails', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      actionHistoryService.create.mockRejectedValue(new Error('DB down'));

      const csv = await service.exportCustomersCsv('biz1');

      expect(csv).toContain('id,name,phone');
    });
  });
});

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

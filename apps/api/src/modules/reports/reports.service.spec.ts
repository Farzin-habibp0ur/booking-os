import { Test } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ReportsService', () => {
  let reportsService: ReportsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    reportsService = module.get(ReportsService);
  });

  describe('noShowRate', () => {
    it('uses startDate/endDate when provided', async () => {
      prisma.booking.count.mockResolvedValue(0);
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-07');

      await reportsService.noShowRate('biz1', 30, start, end);

      expect(prisma.booking.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: { gte: start, lte: end },
          }),
        }),
      );
    });

    it('falls back to days param when no startDate', async () => {
      prisma.booking.count.mockResolvedValue(0);

      await reportsService.noShowRate('biz1', 7);

      const call = prisma.booking.count.mock.calls[0][0] as any;
      expect(call.where.startTime.gte).toBeInstanceOf(Date);
      expect(call.where.startTime.lte).toBeUndefined();
    });
  });

  describe('depositComplianceRate', () => {
    it('returns correct counts for deposit-required bookings', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(10) // totalRequired
        .mockResolvedValueOnce(7); // paid

      const result = await reportsService.depositComplianceRate('biz1');

      expect(result).toEqual({ totalRequired: 10, paid: 7, rate: 70 });
    });
  });

  describe('consultToTreatmentConversion', () => {
    it('returns zero when no consult bookings exist', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await reportsService.consultToTreatmentConversion('biz1', 30);

      expect(result).toEqual({ consultCustomers: 0, converted: 0, rate: 0 });
    });

    it('calculates conversion when some consult customers booked treatments', async () => {
      // Customers with completed consult bookings
      prisma.booking.findMany.mockResolvedValue([
        { customerId: 'c1' },
        { customerId: 'c2' },
        { customerId: 'c3' },
        { customerId: 'c1' }, // duplicate — same customer, two consults
      ] as any);

      // 2 of 3 unique consult customers later booked a treatment
      prisma.booking.groupBy.mockResolvedValue([
        { customerId: 'c1' },
        { customerId: 'c3' },
      ] as any);

      const result = await reportsService.consultToTreatmentConversion('biz1', 30);

      expect(result.consultCustomers).toBe(3); // 3 unique customers
      expect(result.converted).toBe(2);
      expect(result.rate).toBe(67); // 2/3 = 66.67 → rounds to 67
    });

    it('returns 100% when all consult customers converted', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { customerId: 'c1' },
        { customerId: 'c2' },
      ] as any);

      prisma.booking.groupBy.mockResolvedValue([
        { customerId: 'c1' },
        { customerId: 'c2' },
      ] as any);

      const result = await reportsService.consultToTreatmentConversion('biz1', 30);

      expect(result.rate).toBe(100);
    });

    it('queries consult bookings with COMPLETED status', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.consultToTreatmentConversion('biz1', 30);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz1',
            status: 'COMPLETED',
            service: { kind: 'CONSULT' },
          }),
        }),
      );
    });

    it('checks treatment bookings with valid statuses', async () => {
      prisma.booking.findMany.mockResolvedValue([{ customerId: 'c1' }] as any);
      prisma.booking.groupBy.mockResolvedValue([]);

      await reportsService.consultToTreatmentConversion('biz1', 30);

      expect(prisma.booking.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'] },
            service: { kind: 'TREATMENT' },
          }),
        }),
      );
    });
  });
});

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

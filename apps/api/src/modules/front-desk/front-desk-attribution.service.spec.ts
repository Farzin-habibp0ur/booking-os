import { Test } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma.service';
import {
  FrontDeskAttributionService,
  isOutsideBusinessHours,
  BOOKING_ATTRIBUTION_SOURCE,
} from './front-desk-attribution.service';
import { createMockPrisma } from '../../test/mocks';

describe('FrontDeskAttributionService', () => {
  let service: FrontDeskAttributionService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [FrontDeskAttributionService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(FrontDeskAttributionService);

    // Default safe stubs — individual tests override what they need.
    (prisma.waitlistEntry.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.actionCard.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.message.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.outboundDraft.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.business.findUnique as jest.Mock).mockResolvedValue({
      businessHours: null,
      timezone: 'UTC',
    });
    (prisma.frontDeskAttribution.upsert as jest.Mock).mockResolvedValue({});
    (prisma.frontDeskAttribution.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.frontDeskAttribution.findUnique as jest.Mock).mockResolvedValue(null);
  });

  const baseBooking = (overrides: Partial<any> = {}) => ({
    id: 'book1',
    businessId: 'biz1',
    customerId: 'cust1',
    conversationId: null,
    source: 'MANUAL',
    startTime: new Date('2026-05-09T15:00:00Z'),
    customFields: {},
    service: { kind: 'OTHER', price: 200 },
    ...overrides,
  });

  describe('createForBooking — priority order', () => {
    it('returns WAITLIST_MATCH when WaitlistEntry.bookingId points to this booking', async () => {
      (prisma.waitlistEntry.findFirst as jest.Mock).mockResolvedValue({ id: 'wl1' });
      // AI source — should be ignored because waitlist wins.
      await service.createForBooking(prisma as any, baseBooking({ source: 'AI' }));

      expect(prisma.frontDeskAttribution.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bookingId: 'book1' },
          create: expect.objectContaining({
            attributionReason: 'WAITLIST_MATCH',
            wouldHaveBeenMissed: true,
            source: BOOKING_ATTRIBUTION_SOURCE,
            bookingId: 'book1',
            businessId: 'biz1',
            customerId: 'cust1',
          }),
          update: {},
        }),
      );
    });

    it('returns AI_BOOKING when booking.source is AI', async () => {
      await service.createForBooking(prisma as any, baseBooking({ source: 'AI' }));

      expect(prisma.frontDeskAttribution.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            attributionReason: 'AI_BOOKING',
            wouldHaveBeenMissed: true,
          }),
        }),
      );
    });

    it('returns QUOTE_FOLLOWUP when customFields.actionCardId points to a QUOTE_FOLLOWUP card', async () => {
      (prisma.actionCard.findFirst as jest.Mock).mockResolvedValue({ id: 'ac1' });
      await service.createForBooking(
        prisma as any,
        baseBooking({ customFields: { actionCardId: 'ac1' } }),
      );

      expect(prisma.actionCard.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'ac1',
            businessId: 'biz1',
            type: 'QUOTE_FOLLOWUP',
          }),
        }),
      );
      expect(prisma.frontDeskAttribution.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            attributionReason: 'QUOTE_FOLLOWUP',
            wouldHaveBeenMissed: true,
          }),
        }),
      );
    });

    it('returns CONSULT_FOLLOWUP for a TREATMENT booking that follows a recent CONSULT with no prior treatment', async () => {
      (prisma.booking.findFirst as jest.Mock).mockImplementation(async ({ where }: any) => {
        if (where?.service?.kind === 'CONSULT') {
          return {
            id: 'consult1',
            customerId: 'cust1',
            startTime: new Date('2026-05-01T15:00:00Z'),
          };
        }
        // No earlier treatment between consult and the new booking.
        return null;
      });

      await service.createForBooking(
        prisma as any,
        baseBooking({ service: { kind: 'TREATMENT', price: 300 } }),
      );

      expect(prisma.frontDeskAttribution.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            attributionReason: 'CONSULT_FOLLOWUP',
            wouldHaveBeenMissed: true,
          }),
        }),
      );
    });

    it('does NOT return CONSULT_FOLLOWUP when an earlier treatment was already scheduled between consult and booking', async () => {
      (prisma.booking.findFirst as jest.Mock).mockImplementation(async ({ where }: any) => {
        if (where?.service?.kind === 'CONSULT') {
          return {
            id: 'consult1',
            customerId: 'cust1',
            startTime: new Date('2026-05-01T15:00:00Z'),
          };
        }
        if (where?.service?.kind === 'TREATMENT') {
          return { id: 'priorTx' };
        }
        return null;
      });

      await service.createForBooking(
        prisma as any,
        baseBooking({ service: { kind: 'TREATMENT', price: 300 } }),
      );

      expect(prisma.frontDeskAttribution.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            attributionReason: 'ORGANIC',
            wouldHaveBeenMissed: false,
          }),
        }),
      );
    });

    it('returns AFTER_HOURS_AI when first inbound is outside business hours and an AI draft exists', async () => {
      const inboundAt = new Date('2026-05-09T03:00:00Z'); // 3am UTC, before 9-18 hours
      (prisma.message.findMany as jest.Mock).mockResolvedValue([
        { direction: 'INBOUND', createdAt: inboundAt, senderStaffId: null },
      ]);
      (prisma.outboundDraft.findFirst as jest.Mock).mockResolvedValue({
        id: 'd1',
        createdAt: new Date(inboundAt.getTime() + 60_000),
      });
      (prisma.business.findUnique as jest.Mock).mockResolvedValue({
        timezone: 'UTC',
        businessHours: {
          monday: { open: '09:00', close: '18:00' },
          tuesday: { open: '09:00', close: '18:00' },
          wednesday: { open: '09:00', close: '18:00' },
          thursday: { open: '09:00', close: '18:00' },
          friday: { open: '09:00', close: '18:00' },
          saturday: { open: '09:00', close: '18:00' },
          sunday: { open: '09:00', close: '18:00' },
        },
      });

      await service.createForBooking(prisma as any, baseBooking({ conversationId: 'conv1' }), {
        conversationId: 'conv1',
      });

      expect(prisma.frontDeskAttribution.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            attributionReason: 'AFTER_HOURS_AI',
            wouldHaveBeenMissed: true,
            conversationId: 'conv1',
          }),
        }),
      );
    });

    it('returns UNANSWERED_THRESHOLD when staff reply is >15min after inbound and AI drafted first', async () => {
      const inboundAt = new Date('2026-05-09T14:00:00Z'); // inside hours
      const aiAt = new Date(inboundAt.getTime() + 2 * 60_000);
      const staffReplyAt = new Date(inboundAt.getTime() + 20 * 60_000);
      (prisma.message.findMany as jest.Mock).mockResolvedValue([
        { direction: 'INBOUND', createdAt: inboundAt, senderStaffId: null },
        { direction: 'OUTBOUND', createdAt: staffReplyAt, senderStaffId: 'staff1' },
      ]);
      (prisma.outboundDraft.findFirst as jest.Mock).mockResolvedValue({
        id: 'd1',
        createdAt: aiAt,
      });
      (prisma.business.findUnique as jest.Mock).mockResolvedValue({
        timezone: 'UTC',
        businessHours: {
          monday: { open: '09:00', close: '18:00' },
          tuesday: { open: '09:00', close: '18:00' },
          wednesday: { open: '09:00', close: '18:00' },
          thursday: { open: '09:00', close: '18:00' },
          friday: { open: '09:00', close: '18:00' },
          saturday: { open: '09:00', close: '18:00' },
          sunday: { open: '09:00', close: '18:00' },
        },
      });

      await service.createForBooking(prisma as any, baseBooking({ conversationId: 'conv1' }), {
        conversationId: 'conv1',
      });

      expect(prisma.frontDeskAttribution.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            attributionReason: 'UNANSWERED_THRESHOLD',
            wouldHaveBeenMissed: true,
          }),
        }),
      );
    });

    it('falls back to ORGANIC when no rule matches', async () => {
      await service.createForBooking(prisma as any, baseBooking());

      expect(prisma.frontDeskAttribution.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            attributionReason: 'ORGANIC',
            wouldHaveBeenMissed: false,
            source: BOOKING_ATTRIBUTION_SOURCE,
          }),
        }),
      );
    });

    it('uses an upsert keyed by bookingId so repeat calls are idempotent', async () => {
      await service.createForBooking(prisma as any, baseBooking());
      await service.createForBooking(prisma as any, baseBooking());

      const calls = (prisma.frontDeskAttribution.upsert as jest.Mock).mock.calls;
      expect(calls).toHaveLength(2);
      for (const [arg] of calls) {
        expect(arg.where).toEqual({ bookingId: 'book1' });
        expect(arg.update).toEqual({});
      }
    });

    it('resolves revenueAtBooking from totalPaid > amount > service.price', async () => {
      // service.price fallback
      await service.createForBooking(prisma as any, baseBooking());
      expect(
        (prisma.frontDeskAttribution.upsert as jest.Mock).mock.calls[0][0].create.revenueAtBooking,
      ).toBe(200);

      (prisma.frontDeskAttribution.upsert as jest.Mock).mockClear();
      await service.createForBooking(prisma as any, baseBooking({ amount: 250 }) as any);
      expect(
        (prisma.frontDeskAttribution.upsert as jest.Mock).mock.calls[0][0].create.revenueAtBooking,
      ).toBe(250);

      (prisma.frontDeskAttribution.upsert as jest.Mock).mockClear();
      await service.createForBooking(
        prisma as any,
        baseBooking({ totalPaid: 999, amount: 250 }) as any,
      );
      expect(
        (prisma.frontDeskAttribution.upsert as jest.Mock).mock.calls[0][0].create.revenueAtBooking,
      ).toBe(999);
    });
  });

  describe('voidForBooking', () => {
    it('sets voidedAt and clears wouldHaveBeenMissed', async () => {
      await service.voidForBooking(prisma as any, 'book1');

      expect(prisma.frontDeskAttribution.updateMany).toHaveBeenCalledWith({
        where: { bookingId: 'book1' },
        data: expect.objectContaining({
          wouldHaveBeenMissed: false,
          voidedAt: expect.any(Date),
        }),
      });
    });

    it('is a no-op when no row exists (updateMany handles 0 rows)', async () => {
      (prisma.frontDeskAttribution.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      await expect(service.voidForBooking(prisma as any, 'missing')).resolves.toBeUndefined();
    });
  });

  describe('fresh-after-60-days behaviour', () => {
    it('writes a new row keyed by the new bookingId, not by customerId', async () => {
      // First booking voided 70 days ago — irrelevant: row is keyed by bookingId.
      await service.createForBooking(prisma as any, baseBooking({ id: 'book2' }));

      const call = (prisma.frontDeskAttribution.upsert as jest.Mock).mock.calls[0][0];
      expect(call.where).toEqual({ bookingId: 'book2' });
      expect(call.create.bookingId).toBe('book2');
      // No special handling needed — new row is independent.
    });
  });

  describe('getSummary', () => {
    it('aggregates captured + would-have-been-missed + byReason from FrontDeskAttribution rows', async () => {
      (prisma.frontDeskAttribution.findMany as jest.Mock).mockResolvedValue([
        { attributionReason: 'AI_BOOKING', wouldHaveBeenMissed: true, revenueAtBooking: 400 },
        { attributionReason: 'WAITLIST_MATCH', wouldHaveBeenMissed: true, revenueAtBooking: 250 },
        { attributionReason: 'ORGANIC', wouldHaveBeenMissed: false, revenueAtBooking: 350 },
        { attributionReason: 'ORGANIC', wouldHaveBeenMissed: false, revenueAtBooking: 100 },
      ]);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue({
        baselineMonthlyBookings: 30,
        baselineMonthlyRevenue: 12000,
        baselineSource: 'concierge_call',
        baselineCapturedAt: new Date('2026-04-01T00:00:00Z'),
      });
      (prisma.message.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getSummary('biz1', 30);

      expect(result.captured).toEqual({ count: 4, revenue: 1100 });
      expect(result.wouldHaveBeenMissed.count).toBe(2);
      expect(result.wouldHaveBeenMissed.revenue).toBe(650);
      expect(result.wouldHaveBeenMissed.byReason.AI_BOOKING).toEqual({ count: 1, revenue: 400 });
      expect(result.wouldHaveBeenMissed.byReason.ORGANIC).toEqual({ count: 2, revenue: 450 });
      expect(result.baseline).toEqual(
        expect.objectContaining({ monthlyBookings: 30, monthlyRevenue: 12000 }),
      );
    });

    it('caps days at 365', async () => {
      (prisma.frontDeskAttribution.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.message.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getSummary('biz1', 9999);
      expect(result.days).toBe(365);
    });

    it('reads only rows with bookingId set and no voidedAt', async () => {
      (prisma.frontDeskAttribution.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.message.findMany as jest.Mock).mockResolvedValue([]);

      await service.getSummary('biz1', 30);

      const call = (prisma.frontDeskAttribution.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).toEqual(
        expect.objectContaining({
          businessId: 'biz1',
          bookingId: { not: null },
          voidedAt: null,
        }),
      );
    });
  });
});

describe('isOutsideBusinessHours', () => {
  const hours = {
    monday: { open: '09:00', close: '18:00' },
    tuesday: { open: '09:00', close: '18:00' },
    wednesday: { open: '09:00', close: '18:00' },
    thursday: { open: '09:00', close: '18:00' },
    friday: { open: '09:00', close: '18:00' },
    saturday: { open: '09:00', close: '18:00' },
    sunday: { open: '09:00', close: '18:00' },
  };

  it('returns false when businessHours is null (always-open)', () => {
    expect(isOutsideBusinessHours(new Date('2026-05-09T03:00:00Z'), null)).toBe(false);
  });

  it('returns true when the time is before opening', () => {
    expect(isOutsideBusinessHours(new Date('2026-05-09T03:00:00Z'), hours, 'UTC')).toBe(true);
  });

  it('returns true when the time is after closing', () => {
    expect(isOutsideBusinessHours(new Date('2026-05-09T23:00:00Z'), hours, 'UTC')).toBe(true);
  });

  it('returns false when the time is inside business hours', () => {
    expect(isOutsideBusinessHours(new Date('2026-05-09T14:00:00Z'), hours, 'UTC')).toBe(false);
  });

  it('returns true when the day appears in closed[]', () => {
    expect(
      isOutsideBusinessHours(
        new Date('2026-05-10T14:00:00Z'),
        { ...hours, closed: ['sunday'] },
        'UTC',
      ),
    ).toBe(true);
  });
});

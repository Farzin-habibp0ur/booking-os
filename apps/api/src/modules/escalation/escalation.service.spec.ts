import { EscalationService } from './escalation.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('EscalationService', () => {
  let service: EscalationService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new EscalationService(prisma as any);
  });

  describe('evaluateAutoEscalation', () => {
    it('returns GREEN for clean content', () => {
      const result = service.evaluateAutoEscalation({
        title: 'How to book appointments online',
        body: 'A simple guide to using our booking system for your business.',
      });

      expect(result.tier).toBe('GREEN');
      expect(result.triggers).toEqual([]);
    });

    it('promotes to YELLOW on pricing mention', () => {
      const result = service.evaluateAutoEscalation({
        title: 'Our pricing plans',
        body: 'Check out our affordable pricing tiers.',
      });

      expect(result.tier).toBe('YELLOW');
      expect(result.triggers).toContain('MENTIONS_PRICING');
    });

    it('promotes to YELLOW on competitor names', () => {
      const result = service.evaluateAutoEscalation({
        title: 'Why switch from Calendly',
        body: 'Compare our features to Calendly and see the difference.',
      });

      expect(result.tier).toBe('YELLOW');
      expect(result.triggers).toContain('COMPETITOR_NAMES');
    });

    it('promotes to YELLOW on guarantees', () => {
      const result = service.evaluateAutoEscalation({
        title: 'Our promise',
        body: 'We guarantee 100% uptime for your business.',
      });

      expect(result.tier).toBe('YELLOW');
      expect(result.triggers).toContain('GUARANTEES_PROMISES');
    });

    it('promotes to YELLOW on legal/compliance mentions', () => {
      const result = service.evaluateAutoEscalation({
        title: 'HIPAA Compliance',
        body: 'Our platform is HIPAA compliant and certified.',
      });

      expect(result.tier).toBe('YELLOW');
      expect(result.triggers).toContain('LEGAL_COMPLIANCE');
    });

    it('promotes to RED on revenue claims', () => {
      const result = service.evaluateAutoEscalation({
        title: 'Success story',
        body: 'Our client earned $50k more revenue using our platform.',
      });

      expect(result.tier).toBe('RED');
      expect(result.triggers).toContain('REVENUE_CLAIMS');
    });

    it('promotes to RED on ROI guarantees', () => {
      const result = service.evaluateAutoEscalation({
        title: 'ROI Calculator',
        body: 'Get a guaranteed return on investment of 10x.',
      });

      expect(result.tier).toBe('RED');
      expect(result.triggers).toContain('ROI_GUARANTEES');
    });

    it('promotes to RED on contract terms', () => {
      const result = service.evaluateAutoEscalation({
        title: 'Terms',
        body: 'This binding contract outlines the terms and conditions.',
      });

      expect(result.tier).toBe('RED');
      expect(result.triggers).toContain('CONTRACT_TERMS');
    });

    it('promotes to RED on press release language', () => {
      const result = service.evaluateAutoEscalation({
        title: 'Announcement',
        body: 'For immediate release: BookingOS launches new feature.',
      });

      expect(result.tier).toBe('RED');
      expect(result.triggers).toContain('PRESS_RELEASE');
    });

    it('RED takes precedence over YELLOW triggers', () => {
      const result = service.evaluateAutoEscalation({
        title: 'Pricing and ROI',
        body: 'Our pricing is competitive with a guaranteed return on investment.',
      });

      expect(result.tier).toBe('RED');
      // Should only have RED triggers since RED short-circuits YELLOW check
      expect(result.triggers).toContain('ROI_GUARANTEES');
    });

    it('collects multiple triggers of same tier', () => {
      const result = service.evaluateAutoEscalation({
        title: 'Comparison',
        body: 'Unlike Calendly, our pricing is better and we guarantee satisfaction.',
      });

      expect(result.tier).toBe('YELLOW');
      expect(result.triggers.length).toBeGreaterThanOrEqual(2);
    });

    it('preserves existing tier if already set', () => {
      const result = service.evaluateAutoEscalation({
        title: 'Clean content',
        body: 'No triggers here.',
        tier: 'YELLOW',
      });

      expect(result.tier).toBe('YELLOW');
    });
  });

  describe('recordEscalation', () => {
    it('creates an escalation event', async () => {
      const event = {
        id: 'esc1',
        businessId: 'biz1',
        triggerType: 'REVENUE_CLAIMS',
        severity: 'HIGH',
        title: 'Revenue claim detected',
      };
      prisma.escalationEvent.create.mockResolvedValue(event as any);

      const result = await service.recordEscalation({
        businessId: 'biz1',
        triggerType: 'REVENUE_CLAIMS',
        severity: 'HIGH',
        title: 'Revenue claim detected',
        contentDraftId: 'cd1',
      });

      expect(result).toEqual(event);
      expect(prisma.escalationEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          triggerType: 'REVENUE_CLAIMS',
          severity: 'HIGH',
          contentDraftId: 'cd1',
        }),
      });
    });
  });

  describe('getHistory', () => {
    it('returns paginated escalation events', async () => {
      prisma.escalationEvent.findMany.mockResolvedValue([]);
      prisma.escalationEvent.count.mockResolvedValue(0);

      const result = await service.getHistory('biz1', {
        triggerType: 'REVENUE_CLAIMS',
        severity: 'HIGH',
      } as any);

      expect(result).toEqual({ data: [], total: 0 });
      expect(prisma.escalationEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'biz1',
            triggerType: 'REVENUE_CLAIMS',
            severity: 'HIGH',
          },
        }),
      );
    });

    it('filters by isResolved boolean', async () => {
      prisma.escalationEvent.findMany.mockResolvedValue([]);
      prisma.escalationEvent.count.mockResolvedValue(0);

      await service.getHistory('biz1', { isResolved: 'true' } as any);

      expect(prisma.escalationEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isResolved: true }),
        }),
      );
    });

    it('applies date range filters', async () => {
      prisma.escalationEvent.findMany.mockResolvedValue([]);
      prisma.escalationEvent.count.mockResolvedValue(0);

      await service.getHistory('biz1', {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      } as any);

      expect(prisma.escalationEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-03-01'),
              lte: new Date('2026-03-31'),
            },
          }),
        }),
      );
    });
  });

  describe('getStats', () => {
    it('returns counts by trigger type and severity', async () => {
      prisma.escalationEvent.groupBy
        .mockResolvedValueOnce([
          { triggerType: 'REVENUE_CLAIMS', _count: 5 },
          { triggerType: 'COMPETITOR_NAMES', _count: 3 },
        ] as any)
        .mockResolvedValueOnce([
          { severity: 'HIGH', _count: 5 },
          { severity: 'MEDIUM', _count: 3 },
        ] as any);

      const result = await service.getStats('biz1');

      expect(result.byTriggerType).toEqual({ REVENUE_CLAIMS: 5, COMPETITOR_NAMES: 3 });
      expect(result.bySeverity).toEqual({ HIGH: 5, MEDIUM: 3 });
    });
  });

  describe('tenant isolation', () => {
    it('getHistory filters by businessId', async () => {
      prisma.escalationEvent.findMany.mockResolvedValue([]);
      prisma.escalationEvent.count.mockResolvedValue(0);

      await service.getHistory('biz1', {} as any);

      expect(prisma.escalationEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1' } }),
      );
    });

    it('getStats filters by businessId', async () => {
      prisma.escalationEvent.groupBy.mockResolvedValue([] as any);

      await service.getStats('biz1');

      expect(prisma.escalationEvent.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1' } }),
      );
    });
  });
});

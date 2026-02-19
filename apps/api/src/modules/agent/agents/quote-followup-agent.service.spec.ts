import { Test } from '@nestjs/testing';
import { QuoteFollowupAgentService } from './quote-followup-agent.service';
import { AgentFrameworkService } from '../agent-framework.service';
import { ActionCardService } from '../../action-card/action-card.service';
import { PrismaService } from '../../../common/prisma.service';
import { createMockPrisma } from '../../../test/mocks';

describe('QuoteFollowupAgentService', () => {
  let service: QuoteFollowupAgentService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let agentFramework: { registerAgent: jest.Mock };
  let actionCardService: { create: jest.Mock };

  const mockQuote = {
    id: 'q1',
    bookingId: 'b1',
    businessId: 'biz1',
    description: 'Full facial + botox',
    totalAmount: 350,
    status: 'PENDING',
    createdAt: new Date(Date.now() - 5 * 86400000), // 5 days ago
    booking: {
      customer: { id: 'cust1', name: 'Jane Doe' },
      service: { name: 'Facial Treatment' },
    },
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    agentFramework = { registerAgent: jest.fn() };
    actionCardService = { create: jest.fn().mockResolvedValue({ id: 'card1', status: 'PENDING' }) };

    const module = await Test.createTestingModule({
      providers: [
        QuoteFollowupAgentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentFrameworkService, useValue: agentFramework },
        { provide: ActionCardService, useValue: actionCardService },
      ],
    }).compile();

    service = module.get(QuoteFollowupAgentService);
  });

  describe('onModuleInit', () => {
    it('registers itself with the agent framework', () => {
      service.onModuleInit();
      expect(agentFramework.registerAgent).toHaveBeenCalledWith(service);
    });
  });

  describe('agentType', () => {
    it('has QUOTE_FOLLOWUP agent type', () => {
      expect(service.agentType).toBe('QUOTE_FOLLOWUP');
    });
  });

  describe('validateConfig', () => {
    it('returns true for null config', () => {
      expect(service.validateConfig(null)).toBe(true);
    });

    it('returns true for valid config', () => {
      expect(service.validateConfig({ maxCardsPerRun: 5, staleDays: 7, minQuoteAmount: 100 })).toBe(
        true,
      );
    });

    it('returns false for invalid maxCardsPerRun', () => {
      expect(service.validateConfig({ maxCardsPerRun: 0 })).toBe(false);
    });

    it('returns false for invalid staleDays', () => {
      expect(service.validateConfig({ staleDays: 0 })).toBe(false);
    });

    it('returns false for negative minQuoteAmount', () => {
      expect(service.validateConfig({ minQuoteAmount: -1 })).toBe(false);
    });
  });

  describe('execute', () => {
    it('returns 0 cards when no stalled quotes', async () => {
      prisma.quote.findMany.mockResolvedValue([]);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
    });

    it('creates action card for stalled quote', async () => {
      prisma.quote.findMany.mockResolvedValue([mockQuote] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 1 });
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz1',
          type: 'STALLED_QUOTE',
          category: 'OPPORTUNITY',
          title: expect.stringContaining('Jane Doe'),
          customerId: 'cust1',
          bookingId: 'b1',
        }),
      );
    });

    it('includes quote amount in description', async () => {
      prisma.quote.findMany.mockResolvedValue([mockQuote] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);

      await service.execute('biz1', {});

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.description).toContain('$350.00');
      expect(createArg.description).toContain('Facial Treatment');
    });

    it('includes preview data in card', async () => {
      prisma.quote.findMany.mockResolvedValue([mockQuote] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);

      await service.execute('biz1', {});

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.preview.quoteId).toBe('q1');
      expect(createArg.preview.totalAmount).toBe(350);
      expect(createArg.preview.serviceName).toBe('Facial Treatment');
    });

    it('skips quotes with existing pending card', async () => {
      prisma.quote.findMany.mockResolvedValue([mockQuote] as any);
      prisma.actionCard.findFirst.mockResolvedValue({ id: 'existing' } as any);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
    });

    it('respects maxCardsPerRun config', async () => {
      const quotes = [
        { ...mockQuote, id: 'q1' },
        { ...mockQuote, id: 'q2' },
        { ...mockQuote, id: 'q3' },
      ];
      prisma.quote.findMany.mockResolvedValue(quotes as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);

      const result = await service.execute('biz1', { maxCardsPerRun: 2 });

      expect(result).toEqual({ cardsCreated: 2 });
    });

    it('continues on individual quote failure', async () => {
      const quotes = [
        { ...mockQuote, id: 'q1' },
        { ...mockQuote, id: 'q2' },
      ];
      prisma.quote.findMany.mockResolvedValue(quotes as any);
      prisma.actionCard.findFirst
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(null);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 1 });
    });

    it('includes CTA config in card', async () => {
      prisma.quote.findMany.mockResolvedValue([mockQuote] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);

      await service.execute('biz1', {});

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.ctaConfig).toEqual([
        { label: 'Send Follow-up', action: 'send_followup', variant: 'primary' },
        { label: 'Snooze', action: 'snooze', variant: 'secondary' },
        { label: 'Dismiss', action: 'dismiss', variant: 'ghost' },
      ]);
    });
  });

  describe('findStalledQuotes', () => {
    it('returns stalled quotes with customer info', async () => {
      prisma.quote.findMany.mockResolvedValue([mockQuote] as any);

      const result = await service.findStalledQuotes('biz1', 3, 0);

      expect(result).toHaveLength(1);
      expect(result[0].customerName).toBe('Jane Doe');
      expect(result[0].serviceName).toBe('Facial Treatment');
      expect(result[0].totalAmount).toBe(350);
    });

    it('returns empty when no matching quotes', async () => {
      prisma.quote.findMany.mockResolvedValue([]);

      const result = await service.findStalledQuotes('biz1', 3, 0);

      expect(result).toEqual([]);
    });

    it('queries with correct stale date filter', async () => {
      prisma.quote.findMany.mockResolvedValue([]);

      await service.findStalledQuotes('biz1', 5, 100);

      const call = prisma.quote.findMany.mock.calls[0][0] as any;
      expect(call.where.businessId).toBe('biz1');
      expect(call.where.status).toBe('PENDING');
      expect(call.where.totalAmount.gte).toBe(100);
      expect(call.where.createdAt.lte).toBeInstanceOf(Date);
    });
  });
});

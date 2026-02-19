import { Test } from '@nestjs/testing';
import { DataHygieneAgentService } from './data-hygiene-agent.service';
import { AgentFrameworkService } from '../agent-framework.service';
import { ActionCardService } from '../../action-card/action-card.service';
import { PrismaService } from '../../../common/prisma.service';
import { createMockPrisma } from '../../../test/mocks';

describe('DataHygieneAgentService', () => {
  let service: DataHygieneAgentService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let agentFramework: { registerAgent: jest.Mock };
  let actionCardService: { create: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    agentFramework = { registerAgent: jest.fn() };
    actionCardService = { create: jest.fn().mockResolvedValue({ id: 'card1', status: 'PENDING' }) };

    const module = await Test.createTestingModule({
      providers: [
        DataHygieneAgentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentFrameworkService, useValue: agentFramework },
        { provide: ActionCardService, useValue: actionCardService },
      ],
    }).compile();

    service = module.get(DataHygieneAgentService);
  });

  describe('onModuleInit', () => {
    it('registers itself with the agent framework', () => {
      service.onModuleInit();
      expect(agentFramework.registerAgent).toHaveBeenCalledWith(service);
    });
  });

  describe('agentType', () => {
    it('has DATA_HYGIENE agent type', () => {
      expect(service.agentType).toBe('DATA_HYGIENE');
    });
  });

  describe('validateConfig', () => {
    it('returns true for null config', () => {
      expect(service.validateConfig(null)).toBe(true);
    });

    it('returns true for valid config', () => {
      expect(service.validateConfig({ maxCardsPerRun: 5, batchSize: 50 })).toBe(true);
    });

    it('returns false for invalid maxCardsPerRun', () => {
      expect(service.validateConfig({ maxCardsPerRun: 0 })).toBe(false);
    });

    it('returns false for invalid batchSize (must be >= 10)', () => {
      expect(service.validateConfig({ batchSize: 5 })).toBe(false);
    });

    it('returns false for invalid nameMatchThreshold', () => {
      expect(service.validateConfig({ nameMatchThreshold: 2 })).toBe(false);
    });
  });

  describe('compareCustomers', () => {
    it('detects phone + name match', () => {
      const result = service.compareCustomers(
        { id: 'c1', name: 'Jane Doe', phone: '+1 (555) 123-4567', email: null },
        { id: 'c2', name: 'Jane Doe', phone: '5551234567', email: null },
      );

      expect(result).not.toBeNull();
      expect(result!.matchFields).toContain('phone');
      expect(result!.matchFields).toContain('name');
      expect(result!.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('detects email + name match', () => {
      const result = service.compareCustomers(
        { id: 'c1', name: 'Jane Doe', phone: '1111111111', email: 'jane@example.com' },
        { id: 'c2', name: 'Jane Doe', phone: '2222222222', email: 'JANE@EXAMPLE.COM' },
      );

      expect(result).not.toBeNull();
      expect(result!.matchFields).toContain('email');
      expect(result!.matchFields).toContain('name');
    });

    it('detects phone + email match', () => {
      const result = service.compareCustomers(
        { id: 'c1', name: 'Jane Doe', phone: '5551234567', email: 'jane@test.com' },
        { id: 'c2', name: 'Different Name', phone: '5551234567', email: 'jane@test.com' },
      );

      expect(result).not.toBeNull();
      expect(result!.matchFields).toContain('phone');
      expect(result!.matchFields).toContain('email');
    });

    it('returns null for single field match only', () => {
      const result = service.compareCustomers(
        { id: 'c1', name: 'Jane Doe', phone: '5551234567', email: null },
        { id: 'c2', name: 'Totally Different', phone: '9999999999', email: null },
      );

      expect(result).toBeNull();
    });

    it('handles name similarity with typos', () => {
      const result = service.compareCustomers(
        { id: 'c1', name: 'Jane Doe', phone: '5551234567', email: null },
        { id: 'c2', name: 'Jane Do', phone: '5551234567', email: null },
      );

      expect(result).not.toBeNull();
      expect(result!.matchFields).toContain('name');
    });

    it('normalizes phone numbers for comparison', () => {
      const result = service.compareCustomers(
        { id: 'c1', name: 'Jane', phone: '+1 (555) 123-4567', email: 'j@t.com' },
        { id: 'c2', name: 'Jane', phone: '555-123-4567', email: 'j@t.com' },
      );

      expect(result).not.toBeNull();
      expect(result!.matchFields).toContain('phone');
    });
  });

  describe('execute', () => {
    it('returns 0 cards when no duplicates found', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', name: 'Jane', phone: '111', email: null },
        { id: 'c2', name: 'Bob', phone: '222', email: null },
      ] as any);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
    });

    it('creates action card for duplicate pair', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', name: 'Jane Doe', phone: '5551234567', email: 'jane@test.com' },
        { id: 'c2', name: 'Jane Doe', phone: '5551234567', email: 'jane@test.com' },
      ] as any);
      prisma.duplicateCandidate.findFirst.mockResolvedValue(null);
      prisma.duplicateCandidate.create.mockResolvedValue({ id: 'dc1' } as any);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 1 });
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz1',
          type: 'DUPLICATE_CUSTOMER',
          category: 'HYGIENE',
          title: expect.stringContaining('Jane Doe'),
        }),
      );
    });

    it('creates DuplicateCandidate record', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', name: 'Jane', phone: '5551234567', email: 'j@t.com' },
        { id: 'c2', name: 'Jane', phone: '5551234567', email: 'j@t.com' },
      ] as any);
      prisma.duplicateCandidate.findFirst.mockResolvedValue(null);
      prisma.duplicateCandidate.create.mockResolvedValue({ id: 'dc1' } as any);

      await service.execute('biz1', {});

      expect(prisma.duplicateCandidate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          customerId1: 'c1',
          customerId2: 'c2',
        }),
      });
    });

    it('skips pairs with existing pending DuplicateCandidate', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', name: 'Jane', phone: '5551234567', email: 'j@t.com' },
        { id: 'c2', name: 'Jane', phone: '5551234567', email: 'j@t.com' },
      ] as any);
      prisma.duplicateCandidate.findFirst.mockResolvedValue({
        id: 'existing',
        status: 'PENDING',
      } as any);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
    });

    it('respects maxCardsPerRun config', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', name: 'Jane', phone: '5551234567', email: 'j@t.com' },
        { id: 'c2', name: 'Jane', phone: '5551234567', email: 'j@t.com' },
        { id: 'c3', name: 'Jane', phone: '5551234567', email: 'j@t.com' },
      ] as any);
      prisma.duplicateCandidate.findFirst.mockResolvedValue(null);
      prisma.duplicateCandidate.create.mockResolvedValue({ id: 'dc1' } as any);

      const result = await service.execute('biz1', { maxCardsPerRun: 1 });

      expect(result).toEqual({ cardsCreated: 1 });
    });

    it('continues on individual pair failure', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', name: 'Jane', phone: '5551234567', email: 'j@t.com' },
        { id: 'c2', name: 'Jane', phone: '5551234567', email: 'j@t.com' },
        { id: 'c3', name: 'Jane', phone: '5551234567', email: 'j@t.com' },
      ] as any);
      prisma.duplicateCandidate.findFirst.mockResolvedValue(null);
      prisma.duplicateCandidate.create
        .mockRejectedValueOnce(new Error('Unique constraint'))
        .mockResolvedValue({ id: 'dc2' } as any);

      const result = await service.execute('biz1', {});

      // Should continue after first failure
      expect(result.cardsCreated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('findDuplicates', () => {
    it('returns empty array for no customers', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      const result = await service.findDuplicates('biz1', 100);

      expect(result).toEqual([]);
    });

    it('sorts by confidence descending', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', name: 'Jane Doe', phone: '5551234567', email: 'jane@test.com' },
        { id: 'c2', name: 'Jane Doe', phone: '5551234567', email: 'jane@test.com' }, // all 3 match
        { id: 'c3', name: 'Jane Doe', phone: '9999999999', email: 'jane@test.com' }, // name + email match
      ] as any);

      const result = await service.findDuplicates('biz1', 100);

      expect(result.length).toBeGreaterThan(0);
      // First result should have highest confidence
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
      }
    });
  });
});

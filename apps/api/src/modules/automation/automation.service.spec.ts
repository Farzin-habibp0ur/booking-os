import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('AutomationService', () => {
  let automationService: AutomationService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        AutomationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    automationService = module.get(AutomationService);
  });

  describe('getPlaybooks', () => {
    it('returns built-in playbook definitions', () => {
      const playbooks = automationService.getPlaybooks();
      expect(playbooks.length).toBe(3);
      expect(playbooks[0].name).toBe('No-Show Prevention');
    });
  });

  describe('getActivePlaybooks', () => {
    it('marks playbooks as active when matching rule exists', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        { playbook: 'no-show-prevention', isActive: true },
      ] as any);

      const result = await automationService.getActivePlaybooks('biz1');

      expect(result[0].isActive).toBe(true);
      expect(result[0].installed).toBe(true);
      expect(result[1].isActive).toBe(false);
    });
  });

  describe('togglePlaybook', () => {
    it('creates new rule for uninstalled playbook', async () => {
      prisma.automationRule.findFirst.mockResolvedValue(null);
      prisma.automationRule.create.mockResolvedValue({ id: 'rule1', isActive: true } as any);

      const result = await automationService.togglePlaybook('biz1', 'no-show-prevention');

      expect(result.isActive).toBe(true);
      expect(prisma.automationRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          playbook: 'no-show-prevention',
          isActive: true,
        }),
      });
    });

    it('toggles existing playbook rule', async () => {
      prisma.automationRule.findFirst.mockResolvedValue({ id: 'rule1', isActive: true } as any);
      prisma.automationRule.update.mockResolvedValue({ id: 'rule1', isActive: false } as any);

      const result = await automationService.togglePlaybook('biz1', 'no-show-prevention');

      expect(result.isActive).toBe(false);
    });

    it('throws for unknown playbook', async () => {
      await expect(automationService.togglePlaybook('biz1', 'unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createRule', () => {
    it('creates a custom rule', async () => {
      prisma.automationRule.create.mockResolvedValue({
        id: 'rule1',
        name: 'My Rule',
        trigger: 'BOOKING_CREATED',
      } as any);

      const result = await automationService.createRule('biz1', {
        name: 'My Rule',
        trigger: 'BOOKING_CREATED',
      });

      expect(result.name).toBe('My Rule');
    });
  });

  describe('getRules', () => {
    it('returns all rules for business', async () => {
      prisma.automationRule.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }] as any);

      const result = await automationService.getRules('biz1');

      expect(result).toHaveLength(2);
    });
  });

  describe('deleteRule', () => {
    it('deletes existing rule', async () => {
      prisma.automationRule.findFirst.mockResolvedValue({ id: 'r1' } as any);
      prisma.automationRule.delete.mockResolvedValue({} as any);

      const result = await automationService.deleteRule('biz1', 'r1');

      expect(result).toEqual({ deleted: true });
    });

    it('throws for unknown rule', async () => {
      prisma.automationRule.findFirst.mockResolvedValue(null);

      await expect(automationService.deleteRule('biz1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLogs', () => {
    it('returns paginated logs', async () => {
      prisma.automationLog.findMany.mockResolvedValue([{ id: 'log1' }] as any);
      prisma.automationLog.count.mockResolvedValue(1);

      const result = await automationService.getLogs('biz1', {});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('testRule', () => {
    it('returns dry run result for valid rule', async () => {
      prisma.automationRule.findFirst.mockResolvedValue({
        id: 'r1',
        name: 'Test',
        trigger: 'BOOKING_CREATED',
      } as any);

      const result = await automationService.testRule('biz1', 'r1');

      expect(result.dryRun).toBe(true);
    });

    it('throws for unknown rule', async () => {
      prisma.automationRule.findFirst.mockResolvedValue(null);

      await expect(automationService.testRule('biz1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });
});

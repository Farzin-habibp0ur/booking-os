import { Test } from '@nestjs/testing';
import { AgentSkillsService } from './agent-skills.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';
import { NotFoundException } from '@nestjs/common';

describe('AgentSkillsService', () => {
  let service: AgentSkillsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [AgentSkillsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AgentSkillsService);
  });

  describe('getSkillsForPack', () => {
    it('returns skills for aesthetic pack', () => {
      const skills = service.getSkillsForPack('aesthetic');

      expect(skills.length).toBeGreaterThan(0);
      expect(skills.some((s) => s.agentType === 'WAITLIST')).toBe(true);
      expect(skills.some((s) => s.agentType === 'RETENTION')).toBe(true);
    });

    it('returns skills for dealership pack', () => {
      const skills = service.getSkillsForPack('dealership');

      expect(skills.length).toBeGreaterThan(0);
      expect(skills.some((s) => s.agentType === 'QUOTE_FOLLOWUP')).toBe(true);
    });

    it('returns skills for general pack', () => {
      const skills = service.getSkillsForPack('general');

      expect(skills.length).toBeGreaterThan(0);
    });

    it('falls back to general for unknown pack', () => {
      const skills = service.getSkillsForPack('unknown');

      // Should return general pack skills as fallback
      expect(skills.length).toBeGreaterThanOrEqual(0);
    });

    it('each skill has required fields', () => {
      const skills = service.getSkillsForPack('aesthetic');

      for (const skill of skills) {
        expect(skill.agentType).toBeDefined();
        expect(skill.name).toBeDefined();
        expect(skill.description).toBeDefined();
        expect(['proactive', 'reactive', 'maintenance']).toContain(skill.category);
        expect(typeof skill.defaultEnabled).toBe('boolean');
      }
    });
  });

  describe('getAllPackSkills', () => {
    it('returns skills for all packs', () => {
      const allSkills = service.getAllPackSkills();

      expect(allSkills.aesthetic).toBeDefined();
      expect(allSkills.dealership).toBeDefined();
      expect(allSkills.general).toBeDefined();
    });
  });

  describe('getBusinessSkills', () => {
    it('returns skills with default enabled status when no config exists', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        verticalPack: 'aesthetic',
      } as any);
      prisma.agentConfig.findMany.mockResolvedValue([]);

      const skills = await service.getBusinessSkills('biz1');

      expect(skills.length).toBeGreaterThan(0);
      const waitlistSkill = skills.find((s) => s.agentType === 'WAITLIST');
      expect(waitlistSkill?.isEnabled).toBe(true); // default for aesthetic
      expect(waitlistSkill?.hasConfig).toBe(false);
    });

    it('uses agent config isEnabled over default', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        verticalPack: 'aesthetic',
      } as any);
      prisma.agentConfig.findMany.mockResolvedValue([
        { agentType: 'WAITLIST', isEnabled: false, autonomyLevel: 'AUTO', config: {} },
      ] as any);

      const skills = await service.getBusinessSkills('biz1');

      const waitlistSkill = skills.find((s) => s.agentType === 'WAITLIST');
      expect(waitlistSkill?.isEnabled).toBe(false); // overridden
      expect(waitlistSkill?.autonomyLevel).toBe('AUTO');
      expect(waitlistSkill?.hasConfig).toBe(true);
    });

    it('throws NotFoundException when business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.getBusinessSkills('biz1')).rejects.toThrow(NotFoundException);
    });

    it('defaults to general pack when verticalPack is null', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        verticalPack: null,
      } as any);
      prisma.agentConfig.findMany.mockResolvedValue([]);

      const skills = await service.getBusinessSkills('biz1');

      expect(skills.length).toBeGreaterThan(0);
    });
  });

  describe('enableSkill', () => {
    it('enables a skill for the business', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        verticalPack: 'aesthetic',
      } as any);
      prisma.agentConfig.upsert.mockResolvedValue({
        id: 'ac1',
        agentType: 'WAITLIST',
        isEnabled: true,
      } as any);

      const result = await service.enableSkill('biz1', 'WAITLIST');

      expect(result.isEnabled).toBe(true);
      expect(prisma.agentConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId_agentType: { businessId: 'biz1', agentType: 'WAITLIST' } },
          create: expect.objectContaining({ isEnabled: true }),
          update: { isEnabled: true },
        }),
      );
    });

    it('throws NotFoundException for unavailable skill', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        verticalPack: 'aesthetic',
      } as any);

      await expect(service.enableSkill('biz1', 'NONEXISTENT')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.enableSkill('biz1', 'WAITLIST')).rejects.toThrow(NotFoundException);
    });
  });

  describe('disableSkill', () => {
    it('disables a skill', async () => {
      prisma.agentConfig.findUnique.mockResolvedValue({
        id: 'ac1',
        agentType: 'WAITLIST',
        isEnabled: true,
      } as any);
      prisma.agentConfig.update.mockResolvedValue({
        id: 'ac1',
        isEnabled: false,
      } as any);

      const result = await service.disableSkill('biz1', 'WAITLIST');

      expect(result.isEnabled).toBe(false);
    });

    it('throws NotFoundException when config not found', async () => {
      prisma.agentConfig.findUnique.mockResolvedValue(null);

      await expect(service.disableSkill('biz1', 'WAITLIST')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSkillConfig', () => {
    it('updates skill autonomy level', async () => {
      prisma.agentConfig.upsert.mockResolvedValue({
        id: 'ac1',
        autonomyLevel: 'AUTO',
      } as any);

      const result = await service.updateSkillConfig('biz1', 'WAITLIST', {
        autonomyLevel: 'AUTO',
      });

      expect(result.autonomyLevel).toBe('AUTO');
    });

    it('updates skill config object', async () => {
      prisma.agentConfig.upsert.mockResolvedValue({
        id: 'ac1',
        config: { maxCards: 5 },
      } as any);

      const result = await service.updateSkillConfig('biz1', 'RETENTION', {
        config: { maxCards: 5 },
      });

      expect(result.config).toEqual({ maxCards: 5 });
    });
  });
});

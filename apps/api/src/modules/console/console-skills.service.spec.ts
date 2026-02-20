import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConsoleSkillsService } from './console-skills.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConsoleSkillsService', () => {
  let service: ConsoleSkillsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        ConsoleSkillsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ConsoleSkillsService);
  });

  describe('getCatalog', () => {
    it('returns skills grouped by pack with adoption stats', async () => {
      // Business counts for each pack (aesthetic, dealership, general)
      prisma.business.count
        .mockResolvedValueOnce(5)  // aesthetic
        .mockResolvedValueOnce(3)  // dealership
        .mockResolvedValueOnce(2); // general

      // Agent config counts for each skill in each pack
      // aesthetic: 5 skills
      prisma.agentConfig.count
        .mockResolvedValueOnce(4)  // WAITLIST enabled on aesthetic
        .mockResolvedValueOnce(3)  // RETENTION
        .mockResolvedValueOnce(1)  // DATA_HYGIENE
        .mockResolvedValueOnce(5)  // SCHEDULING_OPTIMIZER
        .mockResolvedValueOnce(2)  // QUOTE_FOLLOWUP
        // dealership: 5 skills
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        // general: 5 skills
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      const result = await service.getCatalog();

      expect(result.packs).toHaveLength(3);
      expect(result.packs[0].slug).toBe('aesthetic');
      expect(result.packs[0].skills).toHaveLength(5);
      expect(result.packs[0].skills[0].agentType).toBe('WAITLIST');
      expect(result.packs[0].skills[0].enabledCount).toBe(4);
      expect(result.packs[0].skills[0].businessCount).toBe(5);
      expect(result.packs[0].skills[0].adoptionPercent).toBe(80);
    });

    it('handles zero businesses per pack', async () => {
      prisma.business.count.mockResolvedValue(0);

      const result = await service.getCatalog();

      expect(result.packs).toHaveLength(3);
      for (const pack of result.packs) {
        for (const skill of pack.skills) {
          expect(skill.enabledCount).toBe(0);
          expect(skill.adoptionPercent).toBe(0);
        }
      }
    });

    it('returns correct skill metadata', async () => {
      prisma.business.count.mockResolvedValue(1);
      prisma.agentConfig.count.mockResolvedValue(0);

      const result = await service.getCatalog();

      const aesthetic = result.packs.find((p) => p.slug === 'aesthetic');
      expect(aesthetic).toBeDefined();

      const waitlist = aesthetic!.skills.find((s) => s.agentType === 'WAITLIST');
      expect(waitlist).toBeDefined();
      expect(waitlist!.name).toBe('Waitlist Matching');
      expect(waitlist!.category).toBe('proactive');
      expect(waitlist!.defaultEnabled).toBe(true);
    });
  });

  describe('getSkillAdoption', () => {
    it('returns per-tenant adoption breakdown', async () => {
      prisma.agentConfig.findMany.mockResolvedValue([
        {
          agentType: 'WAITLIST', isEnabled: true, autonomyLevel: 'SUGGEST', createdAt: new Date(),
          business: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic', verticalPack: 'aesthetic' },
        },
        {
          agentType: 'WAITLIST', isEnabled: false, autonomyLevel: 'SUGGEST', createdAt: new Date(),
          business: { id: 'biz2', name: 'Auto Shop', slug: 'auto-shop', verticalPack: 'dealership' },
        },
      ] as any);
      prisma.business.count.mockResolvedValue(10);

      const result = await service.getSkillAdoption('WAITLIST');

      expect(result.agentType).toBe('WAITLIST');
      expect(result.name).toBe('Waitlist Matching');
      expect(result.totalBusinesses).toBe(10);
      expect(result.enabledCount).toBe(1);
      expect(result.configs).toHaveLength(2);
      expect(result.configs[0].businessName).toBe('Glow Clinic');
      expect(result.configs[0].isEnabled).toBe(true);
    });

    it('throws NotFoundException for invalid agentType', async () => {
      await expect(service.getSkillAdoption('INVALID')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('handles no configs', async () => {
      prisma.agentConfig.findMany.mockResolvedValue([]);
      prisma.business.count.mockResolvedValue(5);

      const result = await service.getSkillAdoption('WAITLIST');

      expect(result.enabledCount).toBe(0);
      expect(result.configs).toEqual([]);
    });
  });

  describe('platformOverride', () => {
    it('enables skill for all businesses', async () => {
      prisma.business.findMany.mockResolvedValue([
        { id: 'biz1' },
        { id: 'biz2' },
        { id: 'biz3' },
      ] as any);
      prisma.agentConfig.upsert.mockResolvedValue({} as any);

      const result = await service.platformOverride('WAITLIST', true, 'admin1');

      expect(result.agentType).toBe('WAITLIST');
      expect(result.enabled).toBe(true);
      expect(result.affectedCount).toBe(3);
    });

    it('disables skill for all businesses', async () => {
      prisma.business.findMany.mockResolvedValue([
        { id: 'biz1' },
        { id: 'biz2' },
      ] as any);
      prisma.agentConfig.upsert.mockResolvedValue({} as any);

      const result = await service.platformOverride('WAITLIST', false, 'admin1');

      expect(result.enabled).toBe(false);
      expect(result.affectedCount).toBe(2);
    });

    it('throws NotFoundException for invalid agentType', async () => {
      await expect(service.platformOverride('INVALID', true, 'admin1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('handles zero businesses', async () => {
      prisma.business.findMany.mockResolvedValue([]);

      const result = await service.platformOverride('WAITLIST', true, 'admin1');

      expect(result.affectedCount).toBe(0);
    });

    it('uses transaction for atomicity', async () => {
      prisma.business.findMany.mockResolvedValue([{ id: 'biz1' }] as any);
      prisma.agentConfig.upsert.mockResolvedValue({} as any);

      await service.platformOverride('WAITLIST', true, 'admin1');

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});

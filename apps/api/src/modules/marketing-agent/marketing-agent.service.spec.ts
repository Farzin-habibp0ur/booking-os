import { Test } from '@nestjs/testing';
import { MarketingAgentService } from './marketing-agent.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('MarketingAgentService', () => {
  let service: MarketingAgentService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        MarketingAgentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(MarketingAgentService);
  });

  describe('getBusinessContext', () => {
    it('returns business context with services', async () => {
      prisma.business.findUnique.mockResolvedValue({
        name: 'Glow Clinic',
        verticalPack: 'AESTHETIC',
      } as any);
      prisma.service.findMany.mockResolvedValue([
        { name: 'Facial', description: 'Deep clean' },
        { name: 'Botox', description: 'Anti-aging' },
      ] as any);

      const result = await service.getBusinessContext('biz1');

      expect(result.businessName).toBe('Glow Clinic');
      expect(result.vertical).toBe('AESTHETIC');
      expect(result.topServices).toEqual(['Facial', 'Botox']);
    });

    it('returns defaults when business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      prisma.service.findMany.mockResolvedValue([]);

      const result = await service.getBusinessContext('biz1');

      expect(result.businessName).toBe('Unknown Business');
      expect(result.topServices).toEqual([]);
    });
  });

  describe('getRecentDraftTopics', () => {
    it('returns recent draft titles', async () => {
      prisma.contentDraft.findMany.mockResolvedValue([
        { title: 'Blog Post 1' },
        { title: 'Blog Post 2' },
      ] as any);

      const result = await service.getRecentDraftTopics('biz1');

      expect(result).toEqual(['Blog Post 1', 'Blog Post 2']);
    });

    it('returns empty array when no drafts', async () => {
      prisma.contentDraft.findMany.mockResolvedValue([]);

      const result = await service.getRecentDraftTopics('biz1');

      expect(result).toEqual([]);
    });
  });

  describe('pickNextPillar', () => {
    it('picks pillar with fewest drafts', async () => {
      prisma.contentDraft.groupBy.mockResolvedValue([
        { pillar: 'INDUSTRY_INSIGHTS', _count: 5 },
        { pillar: 'PRODUCT_EDUCATION', _count: 3 },
        { pillar: 'CUSTOMER_SUCCESS', _count: 8 },
        { pillar: 'THOUGHT_LEADERSHIP', _count: 2 },
      ] as any);

      const result = await service.pickNextPillar('biz1');

      // TECHNICAL has 0 (not in results), so it should be picked
      expect(result).toBe('TECHNICAL');
    });

    it('returns first pillar when all counts equal', async () => {
      prisma.contentDraft.groupBy.mockResolvedValue([]);

      const result = await service.pickNextPillar('biz1');

      expect(result).toBe('INDUSTRY_INSIGHTS');
    });
  });

  describe('getContentGaps', () => {
    it('identifies missing channels and pillars', async () => {
      prisma.contentDraft.findMany.mockResolvedValue([
        { channel: 'BLOG', pillar: 'INDUSTRY_INSIGHTS' },
        { channel: 'EMAIL', pillar: 'PRODUCT_EDUCATION' },
      ] as any);

      const result = await service.getContentGaps('biz1');

      expect(result.missingChannels).toContain('TWITTER');
      expect(result.missingChannels).toContain('LINKEDIN');
      expect(result.missingChannels).not.toContain('BLOG');
      expect(result.missingPillars).toContain('CUSTOMER_SUCCESS');
      expect(result.missingPillars).not.toContain('INDUSTRY_INSIGHTS');
    });
  });

  describe('parseAIResponse', () => {
    it('parses valid JSON', () => {
      const result = service.parseAIResponse('{"title":"Test","body":"Content"}');

      expect(result.title).toBe('Test');
      expect(result.body).toBe('Content');
    });

    it('returns fallback for invalid JSON', () => {
      const result = service.parseAIResponse('This is raw text');

      expect(result.title).toBe('Generated Content');
      expect(result.body).toBe('This is raw text');
    });

    it('parses analytics response format', () => {
      const result = service.parseAIResponse(
        '{"summary":"Trends look good","recommendations":["Do X","Do Y"]}',
      );

      expect(result.summary).toBe('Trends look good');
      expect(result.recommendations).toEqual(['Do X', 'Do Y']);
    });
  });
});

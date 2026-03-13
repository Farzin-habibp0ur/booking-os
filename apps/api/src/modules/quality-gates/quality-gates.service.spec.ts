import { NotFoundException } from '@nestjs/common';
import { QualityGateService } from './quality-gates.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('QualityGateService', () => {
  let service: QualityGateService;
  let prisma: MockPrisma;

  const baseDraft = {
    id: 'cd1',
    businessId: 'biz1',
    title: 'Test Post',
    body: 'This is a test blog post with enough words to pass the word count check. Sign up today to get started with our platform.',
    contentType: 'BLOG_POST',
    channel: 'BLOG',
    pillar: 'PRODUCT_EDUCATION',
    tier: 'GREEN',
    slug: '2026-03-12-GREEN-BLOG-en-test-post',
    currentGate: 'GATE_1',
    reviewedById: 'staff1',
    metadata: {},
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new QualityGateService(prisma as any);
  });

  describe('evaluateGate', () => {
    it('throws NotFoundException for missing draft', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(null);

      await expect(service.evaluateGate('biz1', 'missing', 'GATE_1')).rejects.toThrow(NotFoundException);
    });

    it('returns failure for unknown gate', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(baseDraft as any);

      const result = await service.evaluateGate('biz1', 'cd1', 'GATE_99');

      expect(result.passed).toBe(false);
    });

    it('filters by businessId', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(baseDraft as any);

      await service.evaluateGate('biz1', 'cd1', 'GATE_1');

      expect(prisma.contentDraft.findFirst).toHaveBeenCalledWith({
        where: { id: 'cd1', businessId: 'biz1' },
      });
    });
  });

  describe('evaluateGate1 - Research completeness', () => {
    it('passes when all research criteria met', () => {
      const metadata = {
        topicRelevanceScore: 0.85,
        keywordDensity: 2,
        sourceCitations: ['source1'],
        competitorAnalysisDone: true,
        audienceMatchVerified: true,
      };

      const result = service.evaluateGate1(baseDraft, metadata);

      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(5);
      expect(result.checks.every((c) => c.passed)).toBe(true);
    });

    it('fails with R01 on low topic relevance', () => {
      const result = service.evaluateGate1(baseDraft, { topicRelevanceScore: 0.3 });

      expect(result.passed).toBe(false);
      expect(result.rejectionCode).toBe('R01');
    });

    it('fails with R02 on bad keyword density', () => {
      const result = service.evaluateGate1(baseDraft, {
        topicRelevanceScore: 0.8,
        keywordDensity: 5,
      });

      expect(result.passed).toBe(false);
      expect(result.rejectionCode).toBe('R02');
    });
  });

  describe('evaluateGate2 - Creation quality', () => {
    it('passes when all quality criteria met', () => {
      const metadata = {
        readabilityScore: 75,
        grammarCheckPassed: true,
        brandVoiceConsistent: true,
        ctaPresent: true,
        mediaAssetsIncluded: true,
        minWordCount: 5,
        maxWordCount: 10000,
      };

      const result = service.evaluateGate2(baseDraft, metadata);

      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(6);
    });

    it('fails with R03 on brand voice mismatch', () => {
      const result = service.evaluateGate2(baseDraft, {
        readabilityScore: 70,
        grammarCheckPassed: true,
        brandVoiceConsistent: false,
        ctaPresent: true,
        mediaAssetsIncluded: true,
      });

      expect(result.passed).toBe(false);
      expect(result.rejectionCode).toBe('R03');
    });

    it('fails with R04 when no CTA', () => {
      const draft = { ...baseDraft, body: 'Short content without any action words.' };
      const result = service.evaluateGate2(draft, {
        readabilityScore: 70,
        grammarCheckPassed: true,
        brandVoiceConsistent: true,
        ctaPresent: false,
        mediaAssetsIncluded: true,
      });

      expect(result.rejectionCode).toBe('R04');
    });

    it('fails with R08 when missing media', () => {
      const result = service.evaluateGate2(baseDraft, {
        readabilityScore: 70,
        grammarCheckPassed: true,
        brandVoiceConsistent: true,
        ctaPresent: true,
        mediaAssetsIncluded: false,
      });

      expect(result.rejectionCode).toBe('R08');
    });

    it('detects CTA in body text', () => {
      const draft = { ...baseDraft, body: 'Get started with our platform today!' };
      const result = service.evaluateGate2(draft, {
        readabilityScore: 70,
        grammarCheckPassed: true,
        brandVoiceConsistent: true,
        mediaAssetsIncluded: true,
        minWordCount: 1,
      });

      const ctaCheck = result.checks.find((c) => c.name === 'cta_present');
      expect(ctaCheck?.passed).toBe(true);
    });
  });

  describe('evaluateGate3 - Queue entry', () => {
    it('passes with proper slug and metadata', () => {
      const metadata = {
        pillarBalanceOk: true,
        schedulingSlotAvailable: true,
        duplicateCheckPassed: true,
      };

      const result = service.evaluateGate3(baseDraft, metadata);

      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(6);
    });

    it('fails with R07 on duplicate content', () => {
      const result = service.evaluateGate3(baseDraft, { duplicateCheckPassed: false });

      expect(result.rejectionCode).toBe('R07');
    });

    it('fails with R09 on bad naming', () => {
      const draft = { ...baseDraft, slug: 'bad-slug' };
      const result = service.evaluateGate3(draft, { duplicateCheckPassed: true });

      expect(result.rejectionCode).toBe('R09');
    });

    it('fails with R10 on scheduling conflict', () => {
      const result = service.evaluateGate3(baseDraft, {
        duplicateCheckPassed: true,
        schedulingSlotAvailable: false,
      });

      expect(result.rejectionCode).toBe('R10');
    });
  });

  describe('evaluateGate4 - Publish readiness', () => {
    it('passes when all publish criteria met', () => {
      const metadata = {
        utmParametersSet: true,
        platformFormattingVerified: true,
        previewRendered: true,
        publishingWindowOptimal: true,
      };

      const result = service.evaluateGate4(baseDraft, metadata);

      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(5);
    });

    it('fails with R09 on missing platform formatting', () => {
      const result = service.evaluateGate4(baseDraft, {
        utmParametersSet: true,
        platformFormattingVerified: false,
        previewRendered: true,
      });

      expect(result.rejectionCode).toBe('R09');
    });

    it('detects UTM parameters in URL', () => {
      const metadata = {
        publishUrl: 'https://example.com?utm_source=instagram&utm_medium=organic&utm_campaign=spring-promo',
        platformFormattingVerified: true,
        previewRendered: true,
      };

      const result = service.evaluateGate4(baseDraft, metadata);
      const utmCheck = result.checks.find((c) => c.name === 'utm_parameters');
      expect(utmCheck?.passed).toBe(true);
    });
  });

  describe('getGateStatus', () => {
    it('returns gate status with rejection history', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue({
        ...baseDraft,
        rejectionLogs: [{ id: 'rl1', rejectionCode: 'R01' }],
      } as any);

      const result = await service.getGateStatus('biz1', 'cd1');

      expect(result.currentGate).toBe('GATE_1');
      expect(result.tier).toBe('GREEN');
      expect(result.recentRejections).toHaveLength(1);
    });

    it('throws NotFoundException for missing draft', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(null);

      await expect(service.getGateStatus('biz1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});

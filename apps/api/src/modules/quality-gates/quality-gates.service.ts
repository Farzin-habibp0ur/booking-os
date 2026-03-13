import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface GateCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface GateResult {
  passed: boolean;
  gate: string;
  checks: GateCheck[];
  rejectionCode?: string;
}

@Injectable()
export class QualityGateService {
  constructor(private prisma: PrismaService) {}

  async evaluateGate(businessId: string, draftId: string, gate: string): Promise<GateResult> {
    const draft = await this.prisma.contentDraft.findFirst({
      where: { id: draftId, businessId },
    });
    if (!draft) throw new NotFoundException('Content draft not found');

    const metadata = (draft.metadata as any) || {};

    switch (gate) {
      case 'GATE_1':
        return this.evaluateGate1(draft, metadata);
      case 'GATE_2':
        return this.evaluateGate2(draft, metadata);
      case 'GATE_3':
        return this.evaluateGate3(draft, metadata);
      case 'GATE_4':
        return this.evaluateGate4(draft, metadata);
      default:
        return {
          passed: false,
          gate,
          checks: [{ name: 'valid_gate', passed: false, message: `Unknown gate: ${gate}` }],
        };
    }
  }

  evaluateGate1(draft: any, metadata: any): GateResult {
    const checks: GateCheck[] = [];

    const relevanceScore = metadata.topicRelevanceScore ?? 0;
    checks.push({
      name: 'topic_relevance',
      passed: relevanceScore >= 0.7,
      message:
        relevanceScore >= 0.7
          ? 'Topic relevance score adequate'
          : `Topic relevance ${relevanceScore} below threshold 0.7`,
    });

    const keywordDensity = metadata.keywordDensity ?? 0;
    checks.push({
      name: 'keyword_density',
      passed: keywordDensity >= 1 && keywordDensity <= 3,
      message:
        keywordDensity >= 1 && keywordDensity <= 3
          ? 'Keyword density within range'
          : `Keyword density ${keywordDensity}% outside 1-3% range`,
    });

    checks.push({
      name: 'source_citations',
      passed: !!metadata.sourceCitations?.length,
      message: metadata.sourceCitations?.length
        ? 'Source citations present'
        : 'Missing source citations',
    });

    checks.push({
      name: 'competitor_analysis',
      passed: !!metadata.competitorAnalysisDone,
      message: metadata.competitorAnalysisDone
        ? 'Competitor analysis completed'
        : 'Competitor analysis not done',
    });

    checks.push({
      name: 'audience_match',
      passed: !!metadata.audienceMatchVerified,
      message: metadata.audienceMatchVerified
        ? 'Audience match verified'
        : 'Audience match not verified',
    });

    const passed = checks.every((c) => c.passed);
    const rejectionCode = !passed ? this.getGate1RejectionCode(checks) : undefined;

    return { passed, gate: 'GATE_1', checks, rejectionCode };
  }

  evaluateGate2(draft: any, metadata: any): GateResult {
    const checks: GateCheck[] = [];

    const readabilityScore = metadata.readabilityScore ?? 0;
    checks.push({
      name: 'readability',
      passed: readabilityScore >= 60,
      message:
        readabilityScore >= 60
          ? 'Readability score adequate'
          : `Flesch score ${readabilityScore} below 60`,
    });

    checks.push({
      name: 'grammar_check',
      passed: !!metadata.grammarCheckPassed,
      message: metadata.grammarCheckPassed ? 'Grammar check passed' : 'Grammar check failed',
    });

    checks.push({
      name: 'brand_voice',
      passed: !!metadata.brandVoiceConsistent,
      message: metadata.brandVoiceConsistent
        ? 'Brand voice consistent'
        : 'Brand voice mismatch detected',
    });

    const hasCta =
      !!metadata.ctaPresent ||
      /\b(sign up|get started|book now|try free|learn more|start|subscribe)\b/i.test(draft.body);
    checks.push({
      name: 'cta_present',
      passed: hasCta,
      message: hasCta ? 'CTA present' : 'No call-to-action found',
    });

    checks.push({
      name: 'media_assets',
      passed: !!metadata.mediaAssetsIncluded,
      message: metadata.mediaAssetsIncluded ? 'Media assets included' : 'Missing media assets',
    });

    const wordCount = draft.body.split(/\s+/).length;
    const minWords = metadata.minWordCount ?? 100;
    const maxWords = metadata.maxWordCount ?? 5000;
    checks.push({
      name: 'word_count',
      passed: wordCount >= minWords && wordCount <= maxWords,
      message:
        wordCount >= minWords && wordCount <= maxWords
          ? `Word count ${wordCount} within range`
          : `Word count ${wordCount} outside ${minWords}-${maxWords} range`,
    });

    const passed = checks.every((c) => c.passed);
    const rejectionCode = !passed ? this.getGate2RejectionCode(checks) : undefined;

    return { passed, gate: 'GATE_2', checks, rejectionCode };
  }

  evaluateGate3(draft: any, metadata: any): GateResult {
    const checks: GateCheck[] = [];

    const slug = draft.slug || '';
    const namePattern = /^\d{4}-\d{2}-\d{2}-(GREEN|YELLOW|RED)-[A-Z]+-[a-z]{2}-.+$/;
    const hasValidName = namePattern.test(slug);
    checks.push({
      name: 'file_naming',
      passed: hasValidName,
      message: hasValidName
        ? 'File naming convention correct'
        : `Slug "${slug}" does not match YYYY-MM-DD-TIER-PLATFORM-LANG-slug-title format`,
    });

    const requiredMeta = ['pillar', 'contentType', 'channel'];
    const metaComplete = requiredMeta.every((k) => !!(draft as any)[k]);
    checks.push({
      name: 'metadata_complete',
      passed: metaComplete,
      message: metaComplete ? 'Required metadata complete' : 'Missing required metadata fields',
    });

    checks.push({
      name: 'tier_verified',
      passed: !!draft.tier && ['GREEN', 'YELLOW', 'RED'].includes(draft.tier),
      message: draft.tier ? `Tier ${draft.tier} verified` : 'Tier not classified',
    });

    checks.push({
      name: 'pillar_balance',
      passed: metadata.pillarBalanceOk !== false,
      message:
        metadata.pillarBalanceOk !== false
          ? 'Pillar balance acceptable'
          : 'Pillar imbalance detected',
    });

    checks.push({
      name: 'scheduling_slot',
      passed: metadata.schedulingSlotAvailable !== false,
      message:
        metadata.schedulingSlotAvailable !== false
          ? 'Scheduling slot available'
          : 'No scheduling slot available',
    });

    checks.push({
      name: 'no_duplicates',
      passed: metadata.duplicateCheckPassed !== false,
      message:
        metadata.duplicateCheckPassed !== false
          ? 'No duplicate content detected'
          : 'Duplicate content detected',
    });

    const passed = checks.every((c) => c.passed);
    const rejectionCode = !passed ? this.getGate3RejectionCode(checks) : undefined;

    return { passed, gate: 'GATE_3', checks, rejectionCode };
  }

  evaluateGate4(draft: any, metadata: any): GateResult {
    const checks: GateCheck[] = [];

    const utmPattern = /[?&]utm_source=\w+&utm_medium=organic&utm_campaign=[\w-]+/;
    const hasUtm = utmPattern.test(metadata.publishUrl || '') || !!metadata.utmParametersSet;
    checks.push({
      name: 'utm_parameters',
      passed: hasUtm,
      message: hasUtm ? 'UTM parameters present' : 'Missing UTM parameters',
    });

    checks.push({
      name: 'platform_formatting',
      passed: !!metadata.platformFormattingVerified,
      message: metadata.platformFormattingVerified
        ? 'Platform-specific formatting verified'
        : 'Platform formatting not verified',
    });

    checks.push({
      name: 'preview_rendered',
      passed: !!metadata.previewRendered,
      message: metadata.previewRendered ? 'Preview rendered successfully' : 'Preview not rendered',
    });

    checks.push({
      name: 'final_approval',
      passed: !!draft.reviewedById,
      message: draft.reviewedById ? 'Final approval recorded' : 'No final approval recorded',
    });

    checks.push({
      name: 'publishing_window',
      passed: metadata.publishingWindowOptimal !== false,
      message:
        metadata.publishingWindowOptimal !== false
          ? 'Publishing window optimal'
          : 'Outside optimal publishing window',
    });

    const passed = checks.every((c) => c.passed);
    const rejectionCode = !passed ? this.getGate4RejectionCode(checks) : undefined;

    return { passed, gate: 'GATE_4', checks, rejectionCode };
  }

  async getGateStatus(businessId: string, draftId: string) {
    const draft = await this.prisma.contentDraft.findFirst({
      where: { id: draftId, businessId },
      include: { rejectionLogs: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!draft) throw new NotFoundException('Content draft not found');

    return {
      currentGate: draft.currentGate,
      tier: draft.tier,
      qualityScore: draft.qualityScore,
      rejectionCode: draft.rejectionCode,
      rejectionReason: draft.rejectionReason,
      recentRejections: draft.rejectionLogs,
    };
  }

  private getGate1RejectionCode(checks: GateCheck[]): string {
    if (!checks.find((c) => c.name === 'topic_relevance')?.passed) return 'R01';
    return 'R02';
  }

  private getGate2RejectionCode(checks: GateCheck[]): string {
    if (!checks.find((c) => c.name === 'brand_voice')?.passed) return 'R03';
    if (!checks.find((c) => c.name === 'cta_present')?.passed) return 'R04';
    if (!checks.find((c) => c.name === 'media_assets')?.passed) return 'R08';
    return 'R02';
  }

  private getGate3RejectionCode(checks: GateCheck[]): string {
    if (!checks.find((c) => c.name === 'no_duplicates')?.passed) return 'R07';
    if (!checks.find((c) => c.name === 'file_naming')?.passed) return 'R09';
    if (!checks.find((c) => c.name === 'scheduling_slot')?.passed) return 'R10';
    return 'R09';
  }

  private getGate4RejectionCode(checks: GateCheck[]): string {
    if (!checks.find((c) => c.name === 'platform_formatting')?.passed) return 'R09';
    if (!checks.find((c) => c.name === 'utm_parameters')?.passed) return 'R09';
    return 'R06';
  }
}

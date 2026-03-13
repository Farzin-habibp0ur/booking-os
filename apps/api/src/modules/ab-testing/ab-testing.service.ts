import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateAbTestDto, UpdateAbTestDto, QueryAbTestsDto } from './dto';

const MAX_ACTIVE_TESTS = 3;
const DEFAULT_WIN_THRESHOLD = 0.15;
const MIN_TEST_DAYS = 7;

@Injectable()
export class AbTestingService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, dto: CreateAbTestDto) {
    const activeCount = await this.prisma.aBTest.count({
      where: { businessId, status: 'RUNNING' },
    });
    if (activeCount >= MAX_ACTIVE_TESTS) {
      throw new BadRequestException(`Maximum ${MAX_ACTIVE_TESTS} active tests allowed`);
    }

    const test = await this.prisma.aBTest.create({
      data: {
        businessId,
        name: dto.name,
        status: 'DRAFT',
        metric: dto.elementType,
        metadata: {
          elementType: dto.elementType,
          winThreshold: dto.winThreshold ?? DEFAULT_WIN_THRESHOLD,
        },
      },
    });

    await Promise.all([
      this.prisma.aBTestVariant.create({
        data: {
          abTestId: test.id,
          variantLabel: 'control',
          metadata: dto.controlVariant,
        },
      }),
      this.prisma.aBTestVariant.create({
        data: {
          abTestId: test.id,
          variantLabel: 'test',
          metadata: dto.testVariant,
        },
      }),
    ]);

    return this.findOne(businessId, test.id);
  }

  async findAll(businessId: string, query: QueryAbTestsDto) {
    const where: any = { businessId };
    if (query.status) where.status = query.status;
    if (query.elementType) {
      where.metadata = { path: ['elementType'], equals: query.elementType };
    }

    const skip = query.skip ? parseInt(query.skip, 10) : 0;
    const take = Math.min(query.take ? parseInt(query.take, 10) : 20, 100);

    const [data, total] = await Promise.all([
      this.prisma.aBTest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { variants: true },
      }),
      this.prisma.aBTest.count({ where }),
    ]);

    return { data, total };
  }

  async findActive(businessId: string) {
    return this.prisma.aBTest.findMany({
      where: { businessId, status: 'RUNNING' },
      include: { variants: true },
      orderBy: { startedAt: 'asc' },
    });
  }

  async findOne(businessId: string, id: string) {
    const test = await this.prisma.aBTest.findFirst({
      where: { id, businessId },
      include: { variants: true },
    });
    if (!test) throw new NotFoundException('A/B test not found');
    return test;
  }

  async update(businessId: string, id: string, dto: UpdateAbTestDto) {
    await this.findOne(businessId, id);
    return this.prisma.aBTest.update({
      where: { id },
      data: {
        status: dto.status,
        winnerVariantId: dto.winnerVariantId,
        metadata: dto.results ? { results: dto.results } : undefined,
      },
      include: { variants: true },
    });
  }

  async start(businessId: string, id: string) {
    const test = await this.findOne(businessId, id);
    if (test.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT tests can be started');
    }

    const activeCount = await this.prisma.aBTest.count({
      where: { businessId, status: 'RUNNING' },
    });
    if (activeCount >= MAX_ACTIVE_TESTS) {
      throw new BadRequestException(`Maximum ${MAX_ACTIVE_TESTS} active tests allowed`);
    }

    return this.prisma.aBTest.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date() },
      include: { variants: true },
    });
  }

  async complete(businessId: string, id: string) {
    const test = await this.findOne(businessId, id);
    if (test.status !== 'RUNNING') {
      throw new BadRequestException('Only RUNNING tests can be completed');
    }

    if (test.startedAt) {
      const daysSinceStart =
        (Date.now() - new Date(test.startedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceStart < MIN_TEST_DAYS) {
        throw new BadRequestException(
          `Test must run for at least ${MIN_TEST_DAYS} days (${Math.floor(daysSinceStart)} days elapsed)`,
        );
      }
    }

    const variants = test.variants;
    const threshold = ((test.metadata as any)?.winThreshold ?? DEFAULT_WIN_THRESHOLD) as number;

    const control = variants.find((v) => v.variantLabel === 'control');
    const testVariant = variants.find((v) => v.variantLabel === 'test');

    let winnerVariantId: string | null = null;
    let finalStatus = 'COMPLETED';

    if (control && testVariant) {
      const controlRate = control.impressions > 0 ? control.engagementScore || 0 : 0;
      const testRate = testVariant.impressions > 0 ? testVariant.engagementScore || 0 : 0;

      if (testRate > controlRate * (1 + threshold)) {
        winnerVariantId = testVariant.id;
        await this.prisma.aBTestVariant.update({
          where: { id: testVariant.id },
          data: { isWinner: true },
        });
      } else if (controlRate > testRate * (1 + threshold)) {
        winnerVariantId = control.id;
        await this.prisma.aBTestVariant.update({
          where: { id: control.id },
          data: { isWinner: true },
        });
      } else {
        finalStatus = 'COMPLETED';
        // Inconclusive — no winner set
      }
    }

    return this.prisma.aBTest.update({
      where: { id },
      data: {
        status: finalStatus,
        endedAt: new Date(),
        winnerVariantId,
        confidence: this.calculateConfidence(control, testVariant),
      },
      include: { variants: true },
    });
  }

  async cancel(businessId: string, id: string) {
    const test = await this.findOne(businessId, id);
    if (['COMPLETED', 'CANCELLED'].includes(test.status)) {
      throw new BadRequestException(`Cannot cancel test with status ${test.status}`);
    }

    return this.prisma.aBTest.update({
      where: { id },
      data: { status: 'CANCELLED', endedAt: new Date() },
      include: { variants: true },
    });
  }

  private calculateConfidence(control: any, testVariant: any): number | null {
    if (!control || !testVariant) return null;
    if (control.impressions === 0 || testVariant.impressions === 0) return null;

    const totalImpressions = control.impressions + testVariant.impressions;
    if (totalImpressions < 100) return null;

    // Simplified confidence based on sample size
    const minImpressions = Math.min(control.impressions, testVariant.impressions);
    return Math.min(99, Math.round(50 + (minImpressions / 1000) * 50));
  }
}

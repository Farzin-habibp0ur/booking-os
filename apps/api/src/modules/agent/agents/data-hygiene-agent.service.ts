import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../agent-framework.service';
import { ActionCardService } from '../../action-card/action-card.service';

interface DataHygieneAgentConfig {
  maxCardsPerRun?: number;
  batchSize?: number;
  nameMatchThreshold?: number;
}

interface DuplicatePair {
  customer1: { id: string; name: string; phone: string; email: string | null };
  customer2: { id: string; name: string; phone: string; email: string | null };
  confidence: number;
  matchFields: string[];
}

@Injectable()
export class DataHygieneAgentService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'DATA_HYGIENE';
  private readonly logger = new Logger(DataHygieneAgentService.name);

  constructor(
    private prisma: PrismaService,
    private agentFramework: AgentFrameworkService,
    private actionCardService: ActionCardService,
  ) {}

  onModuleInit() {
    this.agentFramework.registerAgent(this);
  }

  validateConfig(config: any): boolean {
    if (!config) return true;
    if (config.maxCardsPerRun !== undefined) {
      if (typeof config.maxCardsPerRun !== 'number' || config.maxCardsPerRun < 1) return false;
    }
    if (config.batchSize !== undefined) {
      if (typeof config.batchSize !== 'number' || config.batchSize < 10) return false;
    }
    if (config.nameMatchThreshold !== undefined) {
      if (
        typeof config.nameMatchThreshold !== 'number' ||
        config.nameMatchThreshold < 0 ||
        config.nameMatchThreshold > 1
      )
        return false;
    }
    return true;
  }

  async execute(businessId: string, config: any): Promise<{ cardsCreated: number }> {
    const agentConfig: DataHygieneAgentConfig = config || {};
    const maxCards = agentConfig.maxCardsPerRun || 10;
    const batchSize = agentConfig.batchSize || 100;

    // Find duplicate candidates
    const duplicates = await this.findDuplicates(businessId, batchSize);

    if (duplicates.length === 0) {
      this.logger.log(`No duplicate candidates found for business ${businessId}`);
      return { cardsCreated: 0 };
    }

    let cardsCreated = 0;

    for (const pair of duplicates) {
      if (cardsCreated >= maxCards) break;

      try {
        // Check if this pair already has a pending DuplicateCandidate record
        const existingCandidate = await this.prisma.duplicateCandidate.findFirst({
          where: {
            businessId,
            status: { in: ['PENDING', 'SNOOZED'] },
            OR: [
              { customerId1: pair.customer1.id, customerId2: pair.customer2.id },
              { customerId1: pair.customer2.id, customerId2: pair.customer1.id },
            ],
          },
        });

        if (existingCandidate) continue;

        // Create DuplicateCandidate record
        await this.prisma.duplicateCandidate.create({
          data: {
            businessId,
            customerId1: pair.customer1.id,
            customerId2: pair.customer2.id,
            confidence: pair.confidence,
            matchFields: pair.matchFields,
          },
        });

        // Create action card
        await this.actionCardService.create({
          businessId,
          type: 'DUPLICATE_CUSTOMER',
          category: 'HYGIENE',
          priority: this.calculatePriority(pair.confidence),
          title: `Possible duplicate: ${pair.customer1.name}`,
          description: `Because ${pair.customer1.name} and ${pair.customer2.name} share ${pair.matchFields.join(' and ')}. Review and merge if they are the same person.`,
          suggestedAction: 'Review customer profiles and merge if duplicate',
          preview: {
            customer1: {
              id: pair.customer1.id,
              name: pair.customer1.name,
              phone: pair.customer1.phone,
              email: pair.customer1.email,
            },
            customer2: {
              id: pair.customer2.id,
              name: pair.customer2.name,
              phone: pair.customer2.phone,
              email: pair.customer2.email,
            },
            matchFields: pair.matchFields,
            confidence: pair.confidence,
          },
          ctaConfig: [
            { label: 'Merge', action: 'merge', variant: 'primary' },
            { label: 'Not Duplicate', action: 'not_duplicate', variant: 'secondary' },
            { label: 'Dismiss', action: 'dismiss', variant: 'ghost' },
          ],
          metadata: {
            customerId1: pair.customer1.id,
            customerId2: pair.customer2.id,
            confidence: pair.confidence,
            matchFields: pair.matchFields,
            source: 'data-hygiene-agent',
          },
        });

        cardsCreated++;
      } catch (err: any) {
        this.logger.warn(
          `Failed to process duplicate pair ${pair.customer1.id}/${pair.customer2.id}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Data hygiene agent created ${cardsCreated} cards for business ${businessId} (${duplicates.length} duplicates found)`,
    );

    return { cardsCreated };
  }

  async findDuplicates(businessId: string, batchSize: number): Promise<DuplicatePair[]> {
    const customers = await this.prisma.customer.findMany({
      where: { businessId },
      select: { id: true, name: true, phone: true, email: true },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    const duplicates: DuplicatePair[] = [];

    // Compare each pair for potential duplicates
    for (let i = 0; i < customers.length; i++) {
      for (let j = i + 1; j < customers.length; j++) {
        const match = this.compareCustomers(customers[i], customers[j]);
        if (match) {
          duplicates.push(match);
        }
      }
    }

    // Sort by confidence (highest first)
    duplicates.sort((a, b) => b.confidence - a.confidence);

    return duplicates;
  }

  compareCustomers(
    c1: { id: string; name: string; phone: string; email: string | null },
    c2: { id: string; name: string; phone: string; email: string | null },
  ): DuplicatePair | null {
    const matchFields: string[] = [];
    let confidence = 0;

    // Phone match (strongest signal)
    if (c1.phone && c2.phone && this.normalizePhone(c1.phone) === this.normalizePhone(c2.phone)) {
      matchFields.push('phone');
      confidence += 0.5;
    }

    // Email match
    if (c1.email && c2.email && c1.email.toLowerCase() === c2.email.toLowerCase()) {
      matchFields.push('email');
      confidence += 0.4;
    }

    // Name similarity
    if (this.isNameSimilar(c1.name, c2.name)) {
      matchFields.push('name');
      confidence += 0.3;
    }

    // Need at least 2 matching fields OR phone+name
    if (matchFields.length < 2) return null;
    if (confidence < 0.6) return null;

    return {
      customer1: c1,
      customer2: c2,
      confidence: Math.min(1, confidence),
      matchFields,
    };
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)\+]/g, '').slice(-10);
  }

  private isNameSimilar(name1: string, name2: string): boolean {
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();

    if (n1 === n2) return true;

    // Check if one name contains the other
    if (n1.includes(n2) || n2.includes(n1)) return true;

    // Simple Levenshtein-like similarity: check if names share enough characters
    const longer = n1.length > n2.length ? n1 : n2;
    const shorter = n1.length > n2.length ? n2 : n1;
    if (longer.length === 0) return false;

    const editDistance = this.levenshtein(shorter, longer);
    const similarity = 1 - editDistance / longer.length;

    return similarity >= 0.8;
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    return matrix[a.length][b.length];
  }

  private calculatePriority(confidence: number): number {
    // Higher confidence = higher priority (40-70 range for hygiene)
    return Math.round(40 + confidence * 30);
  }
}

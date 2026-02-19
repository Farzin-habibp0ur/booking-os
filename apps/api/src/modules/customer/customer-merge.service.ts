import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ActionHistoryService } from '../action-history/action-history.service';

@Injectable()
export class CustomerMergeService {
  private readonly logger = new Logger(CustomerMergeService.name);

  constructor(
    private prisma: PrismaService,
    private actionHistoryService: ActionHistoryService,
  ) {}

  async mergeCustomers(
    businessId: string,
    primaryId: string,
    secondaryId: string,
    staffId?: string,
    staffName?: string,
  ) {
    if (primaryId === secondaryId) {
      throw new BadRequestException('Cannot merge a customer with themselves');
    }

    // Verify both customers exist and belong to the same business
    const [primary, secondary] = await Promise.all([
      this.prisma.customer.findFirst({ where: { id: primaryId, businessId } }),
      this.prisma.customer.findFirst({ where: { id: secondaryId, businessId } }),
    ]);

    if (!primary) throw new NotFoundException('Primary customer not found');
    if (!secondary) throw new NotFoundException('Secondary customer not found');

    // Transfer all relations from secondary to primary
    await this.prisma.$transaction(async (tx) => {
      // Transfer bookings
      await tx.booking.updateMany({
        where: { customerId: secondaryId, businessId },
        data: { customerId: primaryId },
      });

      // Transfer conversations
      await tx.conversation.updateMany({
        where: { customerId: secondaryId, businessId },
        data: { customerId: primaryId },
      });

      // Transfer waitlist entries
      await tx.waitlistEntry.updateMany({
        where: { customerId: secondaryId, businessId },
        data: { customerId: primaryId },
      });

      // Transfer customer notes
      await tx.customerNote.updateMany({
        where: { customerId: secondaryId, businessId },
        data: { customerId: primaryId },
      });

      // Transfer action cards
      await tx.actionCard.updateMany({
        where: { customerId: secondaryId, businessId },
        data: { customerId: primaryId },
      });

      // Transfer outbound drafts
      await tx.outboundDraft.updateMany({
        where: { customerId: secondaryId, businessId },
        data: { customerId: primaryId },
      });

      // Merge tags (union of both)
      const mergedTags = [...new Set([...primary.tags, ...secondary.tags])];

      // Merge custom fields (primary wins on conflicts)
      const primaryFields =
        typeof primary.customFields === 'object'
          ? (primary.customFields as Record<string, any>)
          : {};
      const secondaryFields =
        typeof secondary.customFields === 'object'
          ? (secondary.customFields as Record<string, any>)
          : {};
      const mergedFields = { ...secondaryFields, ...primaryFields };

      // Update primary customer with merged data
      await tx.customer.update({
        where: { id: primaryId },
        data: {
          tags: mergedTags,
          customFields: mergedFields,
          // Fill in email if primary doesn't have one
          ...(primary.email ? {} : secondary.email ? { email: secondary.email } : {}),
        },
      });

      // Update DuplicateCandidate records
      await tx.duplicateCandidate.updateMany({
        where: {
          businessId,
          OR: [
            { customerId1: primaryId, customerId2: secondaryId },
            { customerId1: secondaryId, customerId2: primaryId },
          ],
        },
        data: {
          status: 'MERGED',
          resolvedBy: staffId,
          resolvedAt: new Date(),
        },
      });

      // Delete the secondary customer
      await tx.customer.delete({
        where: { id: secondaryId },
      });
    });

    // Log the merge in action history
    this.actionHistoryService
      .create({
        businessId,
        actorType: staffId ? 'STAFF' : 'AI',
        actorId: staffId,
        actorName: staffName,
        action: 'CUSTOMER_MERGED',
        entityType: 'CUSTOMER',
        entityId: primaryId,
        description: `Merged customer "${secondary.name}" into "${primary.name}"`,
        diff: {
          before: { secondaryId, secondaryName: secondary.name, secondaryPhone: secondary.phone },
          after: { mergedInto: primaryId, primaryName: primary.name },
        },
      })
      .catch((err) => this.logger.warn(`Failed to log customer merge audit: ${err?.message}`));

    this.logger.log(
      `Merged customer ${secondaryId} (${secondary.name}) into ${primaryId} (${primary.name})`,
    );

    return this.prisma.customer.findUnique({
      where: { id: primaryId },
      include: { bookings: true, conversations: true },
    });
  }

  async listDuplicates(
    businessId: string,
    opts?: { status?: string; page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, opts?.page || 1);
    const pageSize = Math.min(100, Math.max(1, opts?.pageSize || 20));
    const where: any = { businessId };
    if (opts?.status) {
      where.status = opts.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.duplicateCandidate.findMany({
        where,
        include: {
          customer1: { select: { id: true, name: true, phone: true, email: true, tags: true } },
          customer2: { select: { id: true, name: true, phone: true, email: true, tags: true } },
        },
        orderBy: { confidence: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.duplicateCandidate.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async snoozeDuplicate(businessId: string, candidateId: string, staffId?: string) {
    const candidate = await this.prisma.duplicateCandidate.findFirst({
      where: { id: candidateId, businessId },
    });
    if (!candidate) throw new NotFoundException('Duplicate candidate not found');

    return this.prisma.duplicateCandidate.update({
      where: { id: candidateId },
      data: {
        status: 'SNOOZED',
        resolvedBy: staffId,
        resolvedAt: new Date(),
      },
    });
  }

  async mergeDuplicateById(
    businessId: string,
    candidateId: string,
    staffId?: string,
    staffName?: string,
  ) {
    const candidate = await this.prisma.duplicateCandidate.findFirst({
      where: { id: candidateId, businessId },
    });
    if (!candidate) throw new NotFoundException('Duplicate candidate not found');

    return this.mergeCustomers(
      businessId,
      candidate.customerId1,
      candidate.customerId2,
      staffId,
      staffName,
    );
  }

  async markNotDuplicateById(businessId: string, candidateId: string, staffId?: string) {
    const candidate = await this.prisma.duplicateCandidate.findFirst({
      where: { id: candidateId, businessId },
    });
    if (!candidate) throw new NotFoundException('Duplicate candidate not found');

    return this.markNotDuplicate(businessId, candidate.customerId1, candidate.customerId2, staffId);
  }

  async markNotDuplicate(
    businessId: string,
    customerId1: string,
    customerId2: string,
    staffId?: string,
  ) {
    const candidate = await this.prisma.duplicateCandidate.findFirst({
      where: {
        businessId,
        OR: [
          { customerId1, customerId2 },
          { customerId1: customerId2, customerId2: customerId1 },
        ],
      },
    });

    if (!candidate) throw new NotFoundException('Duplicate candidate not found');

    return this.prisma.duplicateCandidate.update({
      where: { id: candidate.id },
      data: {
        status: 'NOT_DUPLICATE',
        resolvedBy: staffId,
        resolvedAt: new Date(),
      },
    });
  }
}

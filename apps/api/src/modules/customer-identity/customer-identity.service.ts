import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export type IdentifierType =
  | 'phone'
  | 'email'
  | 'facebookPsid'
  | 'instagramUserId'
  | 'webChatSessionId';

export interface CustomerIdentifiers {
  phone?: string;
  email?: string;
  facebookPsid?: string;
  instagramUserId?: string;
  webChatSessionId?: string;
  name?: string;
}

export interface CustomerChannels {
  phone?: string;
  email?: string;
  facebookPsid?: string;
  instagramUserId?: string;
  webChatSessionId?: string;
}

/**
 * Resolution priority order for customer lookup.
 * Phone is highest priority because it's the most reliable identifier.
 */
const IDENTIFIER_PRIORITY: IdentifierType[] = [
  'phone',
  'email',
  'facebookPsid',
  'instagramUserId',
  'webChatSessionId',
];

@Injectable()
export class CustomerIdentityService {
  private readonly logger = new Logger(CustomerIdentityService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Resolve a customer by looking up identifiers in priority order:
   *   phone → email → facebookPsid → instagramUserId → webChatSessionId
   *
   * If a match is found (non-deleted), returns the existing customer.
   * If no match is found, creates a new customer using the available identifiers.
   */
  async resolveCustomer(businessId: string, identifiers: CustomerIdentifiers) {
    // Try each identifier in priority order
    for (const field of IDENTIFIER_PRIORITY) {
      const value = identifiers[field];
      if (!value) continue;

      const customer = await this.prisma.customer.findFirst({
        where: {
          businessId,
          [field]: value,
          deletedAt: null,
        },
      });

      if (customer) {
        this.logger.debug(`Resolved customer ${customer.id} by ${field}=${value}`);
        return customer;
      }
    }

    // No existing customer found — create a new one
    const data: any = { businessId };

    // Set phone (required field) — use actual phone or generate a placeholder
    if (identifiers.phone) {
      data.phone = identifiers.phone;
    } else if (identifiers.facebookPsid) {
      data.phone = `fb:${identifiers.facebookPsid}`;
    } else if (identifiers.instagramUserId) {
      data.phone = `ig:${identifiers.instagramUserId}`;
    } else if (identifiers.webChatSessionId) {
      data.phone = `web:${identifiers.webChatSessionId}`;
    } else if (identifiers.email) {
      data.phone = `email:${identifiers.email}`;
    } else {
      data.phone = `unknown:${Date.now()}`;
    }

    // Set name
    if (identifiers.name) {
      data.name = identifiers.name;
    } else if (identifiers.phone) {
      data.name = identifiers.phone;
    } else if (identifiers.email) {
      data.name = identifiers.email;
    } else if (identifiers.facebookPsid) {
      data.name = `Facebook User ${identifiers.facebookPsid.slice(-6)}`;
    } else if (identifiers.instagramUserId) {
      data.name = `Instagram User ${identifiers.instagramUserId.slice(-6)}`;
    } else if (identifiers.webChatSessionId) {
      data.name = `Web Visitor ${identifiers.webChatSessionId.slice(-6)}`;
    } else {
      data.name = 'Unknown Customer';
    }

    // Set optional identifiers
    if (identifiers.email) data.email = identifiers.email;
    if (identifiers.facebookPsid) data.facebookPsid = identifiers.facebookPsid;
    if (identifiers.instagramUserId) data.instagramUserId = identifiers.instagramUserId;
    if (identifiers.webChatSessionId) data.webChatSessionId = identifiers.webChatSessionId;

    const customer = await this.prisma.customer.create({ data });
    this.logger.log(`Created new customer ${customer.id} for business ${businessId}`);
    return customer;
  }

  /**
   * Link an identifier to an existing customer.
   * Throws ConflictException if the identifier is already linked to a different customer
   * in the same business.
   */
  async linkIdentifier(customerId: string, type: IdentifierType, value: string) {
    // Verify the customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    // Check for conflict — another customer in the same business with this identifier
    const conflict = await this.prisma.customer.findFirst({
      where: {
        businessId: customer.businessId,
        [type]: value,
        deletedAt: null,
        id: { not: customerId },
      },
    });

    if (conflict) {
      throw new ConflictException(
        `Identifier ${type}=${value} is already linked to customer ${conflict.id}`,
      );
    }

    // Update the customer with the new identifier
    return this.prisma.customer.update({
      where: { id: customerId },
      data: { [type]: value },
    });
  }

  /**
   * Returns the available channel identifiers for a customer.
   * Only includes fields that have non-null values.
   */
  async getCustomerChannels(customerId: string): Promise<CustomerChannels> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        phone: true,
        email: true,
        facebookPsid: true,
        instagramUserId: true,
        webChatSessionId: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    const channels: CustomerChannels = {};

    // Only include real phone numbers (not placeholder prefixes)
    if (
      customer.phone &&
      !customer.phone.startsWith('fb:') &&
      !customer.phone.startsWith('ig:') &&
      !customer.phone.startsWith('web:') &&
      !customer.phone.startsWith('email:') &&
      !customer.phone.startsWith('unknown:')
    ) {
      channels.phone = customer.phone;
    }

    if (customer.email) channels.email = customer.email;
    if (customer.facebookPsid) channels.facebookPsid = customer.facebookPsid;
    if (customer.instagramUserId) channels.instagramUserId = customer.instagramUserId;
    if (customer.webChatSessionId) channels.webChatSessionId = customer.webChatSessionId;

    return channels;
  }

  /**
   * Merge two customer records into one. All conversations, bookings,
   * notes, and waitlist entries are moved from secondary to primary.
   * The secondary customer is soft-deleted.
   */
  async mergeCustomers(
    businessId: string,
    primaryCustomerId: string,
    secondaryCustomerId: string,
    mergedBy?: string,
  ): Promise<{
    merged: boolean;
    movedConversations: number;
    movedBookings: number;
  }> {
    // Verify both customers belong to the same business
    const [primary, secondary] = await Promise.all([
      this.prisma.customer.findFirst({
        where: { id: primaryCustomerId, businessId, deletedAt: null },
      }),
      this.prisma.customer.findFirst({
        where: { id: secondaryCustomerId, businessId, deletedAt: null },
      }),
    ]);

    if (!primary) {
      throw new NotFoundException(`Primary customer ${primaryCustomerId} not found`);
    }
    if (!secondary) {
      throw new NotFoundException(`Secondary customer ${secondaryCustomerId} not found`);
    }
    if (primaryCustomerId === secondaryCustomerId) {
      throw new BadRequestException('Cannot merge a customer with itself');
    }

    // Build identifier updates — copy non-null values from secondary where primary is null
    const identifierUpdates: Record<string, string> = {};
    const mergedIdentifiers: string[] = [];
    const identifierFields: IdentifierType[] = [
      'email',
      'facebookPsid',
      'instagramUserId',
      'webChatSessionId',
    ];

    for (const field of identifierFields) {
      if ((secondary as any)[field] && !(primary as any)[field]) {
        identifierUpdates[field] = (secondary as any)[field];
        mergedIdentifiers.push(field);
      }
    }

    // Merge tags (union, deduplicate)
    const primaryTags = Array.isArray((primary as any).tags) ? (primary as any).tags : [];
    const secondaryTags = Array.isArray((secondary as any).tags) ? (secondary as any).tags : [];
    const mergedTags = [...new Set([...primaryTags, ...secondaryTags])];

    // Merge customFields (primary takes precedence)
    const primaryFields =
      (primary as any).customFields && typeof (primary as any).customFields === 'object'
        ? (primary as any).customFields
        : {};
    const secondaryFields =
      (secondary as any).customFields && typeof (secondary as any).customFields === 'object'
        ? (secondary as any).customFields
        : {};
    const mergedCustomFields = { ...secondaryFields, ...primaryFields };

    // Execute atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Move conversations
      const conversations = await tx.conversation.updateMany({
        where: { customerId: secondaryCustomerId, businessId },
        data: { customerId: primaryCustomerId },
      });

      // Move bookings
      const bookings = await tx.booking.updateMany({
        where: { customerId: secondaryCustomerId, businessId },
        data: { customerId: primaryCustomerId },
      });

      // Move customer notes
      await tx.customerNote.updateMany({
        where: { customerId: secondaryCustomerId, businessId },
        data: { customerId: primaryCustomerId },
      });

      // Move waitlist entries
      await tx.waitlistEntry.updateMany({
        where: { customerId: secondaryCustomerId, businessId },
        data: { customerId: primaryCustomerId },
      });

      // Update primary with merged data
      await tx.customer.update({
        where: { id: primaryCustomerId },
        data: {
          ...identifierUpdates,
          tags: mergedTags,
          customFields: mergedCustomFields,
        },
      });

      // Soft-delete secondary
      await tx.customer.update({
        where: { id: secondaryCustomerId },
        data: { deletedAt: new Date() },
      });

      // Create audit entry
      await tx.actionHistory.create({
        data: {
          businessId,
          actorType: mergedBy ? 'STAFF' : 'SYSTEM',
          actorId: mergedBy,
          action: 'CUSTOMER_MERGED',
          entityType: 'CUSTOMER',
          entityId: primaryCustomerId,
          description: `Merged customer ${secondaryCustomerId} into ${primaryCustomerId}`,
          diff: {
            secondaryCustomerId,
            movedConversations: conversations.count,
            movedBookings: bookings.count,
            mergedIdentifiers,
          },
        },
      });

      return {
        movedConversations: conversations.count,
        movedBookings: bookings.count,
      };
    });

    this.logger.log(
      `Merged customer ${secondaryCustomerId} into ${primaryCustomerId}: ` +
        `${result.movedConversations} conversations, ${result.movedBookings} bookings`,
    );

    return { merged: true, ...result };
  }

  /**
   * Find the most recent open/waiting conversation for a customer.
   * Prefers a conversation matching the preferred channel, but falls
   * back to any open conversation.
   */
  async findConversation(
    businessId: string,
    customerId: string,
    preferredChannel?: string,
  ): Promise<{ id: string; channel: string; status: string } | null> {
    // If a preferred channel is specified, try that first
    if (preferredChannel) {
      const preferred = await this.prisma.conversation.findFirst({
        where: {
          businessId,
          customerId,
          channel: preferredChannel,
          status: { in: ['OPEN', 'WAITING'] },
        },
        orderBy: { lastMessageAt: 'desc' },
        select: { id: true, channel: true, status: true },
      });
      if (preferred) return preferred;
    }

    // Fall back to any open/waiting conversation
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        businessId,
        customerId,
        status: { in: ['OPEN', 'WAITING'] },
      },
      orderBy: { lastMessageAt: 'desc' },
      select: { id: true, channel: true, status: true },
    });

    return conversation;
  }
}

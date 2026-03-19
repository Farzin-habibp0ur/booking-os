import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
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
}

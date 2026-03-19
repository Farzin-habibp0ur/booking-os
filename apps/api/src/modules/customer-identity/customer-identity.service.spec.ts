import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { CustomerIdentityService } from './customer-identity.service';
import { PrismaService } from '../../common/prisma.service';

const mockTx = {
  conversation: { updateMany: jest.fn() },
  booking: { updateMany: jest.fn() },
  customerNote: { updateMany: jest.fn() },
  waitlistEntry: { updateMany: jest.fn() },
  customer: { update: jest.fn() },
  actionHistory: { create: jest.fn() },
};

const mockPrisma = {
  customer: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  conversation: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
};

describe('CustomerIdentityService', () => {
  let service: CustomerIdentityService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CustomerIdentityService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(CustomerIdentityService);

    jest.clearAllMocks();
    // Reset transaction mocks
    mockTx.conversation.updateMany.mockResolvedValue({ count: 0 });
    mockTx.booking.updateMany.mockResolvedValue({ count: 0 });
    mockTx.customerNote.updateMany.mockResolvedValue({ count: 0 });
    mockTx.waitlistEntry.updateMany.mockResolvedValue({ count: 0 });
    mockTx.customer.update.mockResolvedValue({});
    mockTx.actionHistory.create.mockResolvedValue({});
  });

  const businessId = 'biz-1';

  // ─── resolveCustomer ──────────────────────────────────────────────

  describe('resolveCustomer', () => {
    const existingCustomer = {
      id: 'cust-1',
      businessId,
      name: 'Alice',
      phone: '+1234567890',
      email: 'alice@example.com',
      facebookPsid: null,
      instagramUserId: null,
      webChatSessionId: null,
      deletedAt: null,
    };

    it('should find existing customer by phone', async () => {
      mockPrisma.customer.findFirst.mockResolvedValueOnce(existingCustomer);

      const result = await service.resolveCustomer(businessId, {
        phone: '+1234567890',
        email: 'alice@example.com',
      });

      expect(result).toEqual(existingCustomer);
      expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith({
        where: { businessId, phone: '+1234567890', deletedAt: null },
      });
      // Should not have tried email since phone matched
      expect(mockPrisma.customer.create).not.toHaveBeenCalled();
    });

    it('should find existing customer by email', async () => {
      mockPrisma.customer.findFirst.mockResolvedValueOnce(null); // phone miss
      mockPrisma.customer.findFirst.mockResolvedValueOnce(existingCustomer); // email hit

      const result = await service.resolveCustomer(businessId, {
        phone: '+9999999999',
        email: 'alice@example.com',
      });

      expect(result).toEqual(existingCustomer);
      expect(mockPrisma.customer.findFirst).toHaveBeenCalledTimes(2);
    });

    it('should find existing customer by facebookPsid', async () => {
      const fbCustomer = { ...existingCustomer, facebookPsid: 'fb-123' };
      mockPrisma.customer.findFirst.mockResolvedValueOnce(fbCustomer);

      const result = await service.resolveCustomer(businessId, {
        facebookPsid: 'fb-123',
      });

      expect(result).toEqual(fbCustomer);
      expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith({
        where: { businessId, facebookPsid: 'fb-123', deletedAt: null },
      });
    });

    it('should find existing customer by instagramUserId', async () => {
      const igCustomer = { ...existingCustomer, instagramUserId: 'ig-456' };
      mockPrisma.customer.findFirst.mockResolvedValueOnce(igCustomer);

      const result = await service.resolveCustomer(businessId, {
        instagramUserId: 'ig-456',
      });

      expect(result).toEqual(igCustomer);
      expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith({
        where: { businessId, instagramUserId: 'ig-456', deletedAt: null },
      });
    });

    it('should find existing customer by webChatSessionId', async () => {
      const webCustomer = { ...existingCustomer, webChatSessionId: 'web-789' };
      mockPrisma.customer.findFirst.mockResolvedValueOnce(webCustomer);

      const result = await service.resolveCustomer(businessId, {
        webChatSessionId: 'web-789',
      });

      expect(result).toEqual(webCustomer);
      expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith({
        where: { businessId, webChatSessionId: 'web-789', deletedAt: null },
      });
    });

    it('should create new customer when no match found (with phone)', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      const newCustomer = { id: 'cust-new', businessId, phone: '+5551234', name: 'Bob' };
      mockPrisma.customer.create.mockResolvedValueOnce(newCustomer);

      const result = await service.resolveCustomer(businessId, {
        phone: '+5551234',
        name: 'Bob',
      });

      expect(result).toEqual(newCustomer);
      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId,
          phone: '+5551234',
          name: 'Bob',
        }),
      });
    });

    it('should create new customer when no match found (with facebookPsid only)', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      const newCustomer = {
        id: 'cust-fb',
        businessId,
        phone: 'fb:psid123456',
        name: 'Facebook User 123456',
      };
      mockPrisma.customer.create.mockResolvedValueOnce(newCustomer);

      const result = await service.resolveCustomer(businessId, {
        facebookPsid: 'psid123456',
      });

      expect(result).toEqual(newCustomer);
      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId,
          phone: 'fb:psid123456',
          name: 'Facebook User 123456',
          facebookPsid: 'psid123456',
        }),
      });
    });

    it('should create new customer when no match found (with instagramUserId only)', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      const newCustomer = {
        id: 'cust-ig',
        businessId,
        phone: 'ig:iguser789',
        name: 'Instagram User er789',
      };
      mockPrisma.customer.create.mockResolvedValueOnce(newCustomer);

      await service.resolveCustomer(businessId, {
        instagramUserId: 'iguser789',
      });

      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId,
          phone: 'ig:iguser789',
          instagramUserId: 'iguser789',
        }),
      });
    });

    it('should create new customer when no match found (with webChatSessionId only)', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      const newCustomer = {
        id: 'cust-web',
        businessId,
        phone: 'web:sess-abc',
        name: 'Web Visitor ss-abc',
      };
      mockPrisma.customer.create.mockResolvedValueOnce(newCustomer);

      await service.resolveCustomer(businessId, {
        webChatSessionId: 'sess-abc',
      });

      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId,
          phone: 'web:sess-abc',
          webChatSessionId: 'sess-abc',
        }),
      });
    });

    it('should create new customer when no match found (with email only)', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      const newCustomer = {
        id: 'cust-email',
        businessId,
        phone: 'email:bob@test.com',
        name: 'bob@test.com',
      };
      mockPrisma.customer.create.mockResolvedValueOnce(newCustomer);

      await service.resolveCustomer(businessId, {
        email: 'bob@test.com',
      });

      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId,
          phone: 'email:bob@test.com',
          name: 'bob@test.com',
          email: 'bob@test.com',
        }),
      });
    });

    it('should respect priority order: phone wins over email', async () => {
      const phoneCustomer = { ...existingCustomer, id: 'cust-phone' };
      // Phone lookup returns a match
      mockPrisma.customer.findFirst.mockResolvedValueOnce(phoneCustomer);

      const result = await service.resolveCustomer(businessId, {
        phone: '+1234567890',
        email: 'different@example.com',
      });

      expect(result.id).toBe('cust-phone');
      // Should only have called findFirst once (for phone)
      expect(mockPrisma.customer.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should respect priority order: email wins over facebookPsid', async () => {
      const emailCustomer = { ...existingCustomer, id: 'cust-email' };
      mockPrisma.customer.findFirst.mockResolvedValueOnce(null); // phone miss
      mockPrisma.customer.findFirst.mockResolvedValueOnce(emailCustomer); // email hit

      const result = await service.resolveCustomer(businessId, {
        phone: '+000',
        email: 'alice@example.com',
        facebookPsid: 'fb-999',
      });

      expect(result.id).toBe('cust-email');
      expect(mockPrisma.customer.findFirst).toHaveBeenCalledTimes(2);
    });

    it('should respect priority order: facebookPsid wins over instagramUserId', async () => {
      const fbCustomer = { ...existingCustomer, id: 'cust-fb', facebookPsid: 'fb-111' };
      mockPrisma.customer.findFirst.mockResolvedValueOnce(fbCustomer); // facebookPsid hit

      const result = await service.resolveCustomer(businessId, {
        facebookPsid: 'fb-111',
        instagramUserId: 'ig-222',
      });

      expect(result.id).toBe('cust-fb');
      expect(mockPrisma.customer.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should skip deleted customers', async () => {
      // findFirst with deletedAt: null will not return deleted customers
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      const newCustomer = { id: 'cust-new', businessId, phone: '+111', name: '+111' };
      mockPrisma.customer.create.mockResolvedValueOnce(newCustomer);

      await service.resolveCustomer(businessId, { phone: '+111' });

      expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ deletedAt: null }),
      });
      expect(mockPrisma.customer.create).toHaveBeenCalled();
    });

    it('should handle empty identifiers and create customer with fallback', async () => {
      const newCustomer = {
        id: 'cust-unknown',
        businessId,
        phone: 'unknown:123',
        name: 'Unknown Customer',
      };
      mockPrisma.customer.create.mockResolvedValueOnce(newCustomer);

      const result = await service.resolveCustomer(businessId, {});

      expect(result).toEqual(newCustomer);
      expect(mockPrisma.customer.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId,
          name: 'Unknown Customer',
        }),
      });
    });

    it('should handle undefined identifier values gracefully', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      const newCustomer = { id: 'cust-x', businessId, phone: '+555', name: 'Test' };
      mockPrisma.customer.create.mockResolvedValueOnce(newCustomer);

      await service.resolveCustomer(businessId, {
        phone: '+555',
        email: undefined,
        facebookPsid: undefined,
        name: 'Test',
      });

      // Should only try phone (skipping undefined values)
      expect(mockPrisma.customer.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrisma.customer.create).toHaveBeenCalled();
    });

    it('should set all provided identifiers on new customer', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      const newCustomer = { id: 'cust-full', businessId };
      mockPrisma.customer.create.mockResolvedValueOnce(newCustomer);

      await service.resolveCustomer(businessId, {
        phone: '+555',
        email: 'test@test.com',
        facebookPsid: 'fb-x',
        instagramUserId: 'ig-x',
        webChatSessionId: 'web-x',
        name: 'Full Contact',
      });

      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: {
          businessId,
          phone: '+555',
          name: 'Full Contact',
          email: 'test@test.com',
          facebookPsid: 'fb-x',
          instagramUserId: 'ig-x',
          webChatSessionId: 'web-x',
        },
      });
    });
  });

  // ─── linkIdentifier ───────────────────────────────────────────────

  describe('linkIdentifier', () => {
    const customer = {
      id: 'cust-1',
      businessId,
      name: 'Alice',
      phone: '+1234567890',
    };

    it('should link a phone identifier', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(customer);
      mockPrisma.customer.findFirst.mockResolvedValueOnce(null); // no conflict
      const updated = { ...customer, phone: '+9876543210' };
      mockPrisma.customer.update.mockResolvedValueOnce(updated);

      const result = await service.linkIdentifier('cust-1', 'phone', '+9876543210');

      expect(result).toEqual(updated);
      expect(mockPrisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { phone: '+9876543210' },
      });
    });

    it('should link an email identifier', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(customer);
      mockPrisma.customer.findFirst.mockResolvedValueOnce(null);
      const updated = { ...customer, email: 'alice@new.com' };
      mockPrisma.customer.update.mockResolvedValueOnce(updated);

      const result = await service.linkIdentifier('cust-1', 'email', 'alice@new.com');

      expect(result).toEqual(updated);
    });

    it('should link a facebookPsid identifier', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(customer);
      mockPrisma.customer.findFirst.mockResolvedValueOnce(null);
      const updated = { ...customer, facebookPsid: 'fb-new' };
      mockPrisma.customer.update.mockResolvedValueOnce(updated);

      const result = await service.linkIdentifier('cust-1', 'facebookPsid', 'fb-new');

      expect(result).toEqual(updated);
    });

    it('should link an instagramUserId identifier', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(customer);
      mockPrisma.customer.findFirst.mockResolvedValueOnce(null);
      const updated = { ...customer, instagramUserId: 'ig-new' };
      mockPrisma.customer.update.mockResolvedValueOnce(updated);

      const result = await service.linkIdentifier('cust-1', 'instagramUserId', 'ig-new');

      expect(result).toEqual(updated);
    });

    it('should link a webChatSessionId identifier', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(customer);
      mockPrisma.customer.findFirst.mockResolvedValueOnce(null);
      const updated = { ...customer, webChatSessionId: 'web-new' };
      mockPrisma.customer.update.mockResolvedValueOnce(updated);

      const result = await service.linkIdentifier('cust-1', 'webChatSessionId', 'web-new');

      expect(result).toEqual(updated);
    });

    it('should throw ConflictException when identifier is linked to another customer', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(customer);
      mockPrisma.customer.findFirst.mockResolvedValueOnce({
        id: 'cust-other',
        businessId,
        email: 'taken@example.com',
      });

      await expect(service.linkIdentifier('cust-1', 'email', 'taken@example.com')).rejects.toThrow(
        ConflictException,
      );

      expect(mockPrisma.customer.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(null);

      await expect(service.linkIdentifier('nonexistent', 'phone', '+111')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not conflict with the same customer (re-linking same value)', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(customer);
      // findFirst excludes the current customer via id: { not: customerId }
      mockPrisma.customer.findFirst.mockResolvedValueOnce(null);
      const updated = { ...customer, email: 'alice@example.com' };
      mockPrisma.customer.update.mockResolvedValueOnce(updated);

      const result = await service.linkIdentifier('cust-1', 'email', 'alice@example.com');

      expect(result).toEqual(updated);
      expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: { not: 'cust-1' },
        }),
      });
    });
  });

  // ─── getCustomerChannels ──────────────────────────────────────────

  describe('getCustomerChannels', () => {
    it('should return all available channels', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        phone: '+1234567890',
        email: 'alice@example.com',
        facebookPsid: 'fb-123',
        instagramUserId: 'ig-456',
        webChatSessionId: 'web-789',
      });

      const result = await service.getCustomerChannels('cust-1');

      expect(result).toEqual({
        phone: '+1234567890',
        email: 'alice@example.com',
        facebookPsid: 'fb-123',
        instagramUserId: 'ig-456',
        webChatSessionId: 'web-789',
      });
    });

    it('should exclude null/missing channels', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        phone: '+1234567890',
        email: null,
        facebookPsid: null,
        instagramUserId: 'ig-456',
        webChatSessionId: null,
      });

      const result = await service.getCustomerChannels('cust-1');

      expect(result).toEqual({
        phone: '+1234567890',
        instagramUserId: 'ig-456',
      });
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('facebookPsid');
      expect(result).not.toHaveProperty('webChatSessionId');
    });

    it('should exclude placeholder phone numbers (fb: prefix)', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        phone: 'fb:psid123',
        email: null,
        facebookPsid: 'psid123',
        instagramUserId: null,
        webChatSessionId: null,
      });

      const result = await service.getCustomerChannels('cust-1');

      expect(result).toEqual({
        facebookPsid: 'psid123',
      });
      expect(result).not.toHaveProperty('phone');
    });

    it('should exclude placeholder phone numbers (ig: prefix)', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        phone: 'ig:ig123',
        email: null,
        facebookPsid: null,
        instagramUserId: 'ig123',
        webChatSessionId: null,
      });

      const result = await service.getCustomerChannels('cust-1');

      expect(result).toEqual({
        instagramUserId: 'ig123',
      });
    });

    it('should exclude placeholder phone numbers (web: prefix)', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        phone: 'web:sess-abc',
        email: null,
        facebookPsid: null,
        instagramUserId: null,
        webChatSessionId: 'sess-abc',
      });

      const result = await service.getCustomerChannels('cust-1');

      expect(result).toEqual({
        webChatSessionId: 'sess-abc',
      });
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(null);

      await expect(service.getCustomerChannels('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return empty object when customer has no real channels', async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        phone: 'unknown:1234',
        email: null,
        facebookPsid: null,
        instagramUserId: null,
        webChatSessionId: null,
      });

      const result = await service.getCustomerChannels('cust-1');

      expect(result).toEqual({});
    });
  });

  // ─── mergeCustomers ────────────────────────────────────────────────

  describe('mergeCustomers', () => {
    const primaryCustomer = {
      id: 'cust-primary',
      businessId,
      phone: '+1111111111',
      email: 'primary@example.com',
      facebookPsid: null,
      instagramUserId: null,
      webChatSessionId: null,
      tags: ['vip'],
      customFields: { preference: 'morning' },
      deletedAt: null,
    };

    const secondaryCustomer = {
      id: 'cust-secondary',
      businessId,
      phone: '+2222222222',
      email: null,
      facebookPsid: 'fb-secondary',
      instagramUserId: 'ig-secondary',
      webChatSessionId: null,
      tags: ['vip', 'new'],
      customFields: { preference: 'evening', source: 'referral' },
      deletedAt: null,
    };

    it('should merge customers and move conversations and bookings', async () => {
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce(primaryCustomer)
        .mockResolvedValueOnce(secondaryCustomer);
      mockTx.conversation.updateMany.mockResolvedValue({ count: 3 });
      mockTx.booking.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.mergeCustomers(
        businessId,
        'cust-primary',
        'cust-secondary',
        'staff-1',
      );

      expect(result).toEqual({ merged: true, movedConversations: 3, movedBookings: 2 });
      expect(mockTx.conversation.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-secondary', businessId },
        data: { customerId: 'cust-primary' },
      });
      expect(mockTx.booking.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-secondary', businessId },
        data: { customerId: 'cust-primary' },
      });
    });

    it('should copy identifiers from secondary where primary is null', async () => {
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce(primaryCustomer)
        .mockResolvedValueOnce(secondaryCustomer);

      await service.mergeCustomers(businessId, 'cust-primary', 'cust-secondary');

      expect(mockTx.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-primary' },
          data: expect.objectContaining({
            facebookPsid: 'fb-secondary',
            instagramUserId: 'ig-secondary',
          }),
        }),
      );
    });

    it('should keep primary email when both have email (no overwrite)', async () => {
      const secondaryWithEmail = { ...secondaryCustomer, email: 'secondary@example.com' };
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce(primaryCustomer)
        .mockResolvedValueOnce(secondaryWithEmail);

      await service.mergeCustomers(businessId, 'cust-primary', 'cust-secondary');

      // Should NOT overwrite primary's email
      const updateCall = mockTx.customer.update.mock.calls.find(
        (c: any) => c[0].where.id === 'cust-primary',
      );
      expect(updateCall[0].data.email).toBeUndefined();
    });

    it('should merge tags with deduplication', async () => {
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce(primaryCustomer)
        .mockResolvedValueOnce(secondaryCustomer);

      await service.mergeCustomers(businessId, 'cust-primary', 'cust-secondary');

      const updateCall = mockTx.customer.update.mock.calls.find(
        (c: any) => c[0].where.id === 'cust-primary',
      );
      expect(updateCall[0].data.tags).toEqual(['vip', 'new']);
    });

    it('should merge customFields with primary taking precedence', async () => {
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce(primaryCustomer)
        .mockResolvedValueOnce(secondaryCustomer);

      await service.mergeCustomers(businessId, 'cust-primary', 'cust-secondary');

      const updateCall = mockTx.customer.update.mock.calls.find(
        (c: any) => c[0].where.id === 'cust-primary',
      );
      expect(updateCall[0].data.customFields).toEqual({
        preference: 'morning', // primary wins
        source: 'referral', // from secondary
      });
    });

    it('should soft-delete the secondary customer', async () => {
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce(primaryCustomer)
        .mockResolvedValueOnce(secondaryCustomer);

      await service.mergeCustomers(businessId, 'cust-primary', 'cust-secondary');

      const deleteCall = mockTx.customer.update.mock.calls.find(
        (c: any) => c[0].where.id === 'cust-secondary',
      );
      expect(deleteCall[0].data.deletedAt).toBeInstanceOf(Date);
    });

    it('should create audit trail', async () => {
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce(primaryCustomer)
        .mockResolvedValueOnce(secondaryCustomer);

      await service.mergeCustomers(businessId, 'cust-primary', 'cust-secondary', 'staff-1');

      expect(mockTx.actionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId,
          actorType: 'STAFF',
          actorId: 'staff-1',
          action: 'CUSTOMER_MERGED',
          entityType: 'CUSTOMER',
          entityId: 'cust-primary',
        }),
      });
    });

    it('should use SYSTEM actor when no staffId provided', async () => {
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce(primaryCustomer)
        .mockResolvedValueOnce(secondaryCustomer);

      await service.mergeCustomers(businessId, 'cust-primary', 'cust-secondary');

      expect(mockTx.actionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ actorType: 'SYSTEM', actorId: undefined }),
      });
    });

    it('should reject when primary customer not found', async () => {
      mockPrisma.customer.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.mergeCustomers(businessId, 'nonexistent', 'cust-secondary'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when secondary customer not found', async () => {
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce(primaryCustomer)
        .mockResolvedValueOnce(null);

      await expect(
        service.mergeCustomers(businessId, 'cust-primary', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject merging a customer with itself', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(primaryCustomer);

      await expect(
        service.mergeCustomers(businessId, 'cust-primary', 'cust-primary'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findConversation ──────────────────────────────────────────────

  describe('findConversation', () => {
    it('should find open conversation matching preferred channel', async () => {
      const conv = { id: 'conv-wa', channel: 'WHATSAPP', status: 'OPEN' };
      mockPrisma.conversation.findFirst.mockResolvedValueOnce(conv);

      const result = await service.findConversation(businessId, 'cust-1', 'WHATSAPP');

      expect(result).toEqual(conv);
      expect(mockPrisma.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          businessId,
          customerId: 'cust-1',
          channel: 'WHATSAPP',
          status: { in: ['OPEN', 'WAITING'] },
        },
        orderBy: { lastMessageAt: 'desc' },
        select: { id: true, channel: true, status: true },
      });
    });

    it('should fall back to any open conversation when preferred channel has none', async () => {
      const conv = { id: 'conv-email', channel: 'EMAIL', status: 'WAITING' };
      mockPrisma.conversation.findFirst
        .mockResolvedValueOnce(null) // no WHATSAPP conversation
        .mockResolvedValueOnce(conv); // fallback finds EMAIL

      const result = await service.findConversation(businessId, 'cust-1', 'WHATSAPP');

      expect(result).toEqual(conv);
      expect(mockPrisma.conversation.findFirst).toHaveBeenCalledTimes(2);
    });

    it('should find any open conversation when no preferred channel', async () => {
      const conv = { id: 'conv-sms', channel: 'SMS', status: 'OPEN' };
      mockPrisma.conversation.findFirst.mockResolvedValueOnce(conv);

      const result = await service.findConversation(businessId, 'cust-1');

      expect(result).toEqual(conv);
      // Should only query once (no preferred channel check)
      expect(mockPrisma.conversation.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrisma.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          businessId,
          customerId: 'cust-1',
          status: { in: ['OPEN', 'WAITING'] },
        },
        orderBy: { lastMessageAt: 'desc' },
        select: { id: true, channel: true, status: true },
      });
    });

    it('should return null when no open conversations exist', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(null);

      const result = await service.findConversation(businessId, 'cust-1', 'WHATSAPP');

      expect(result).toBeNull();
    });

    it('should not return resolved or snoozed conversations', async () => {
      // The query uses status: { in: ['OPEN', 'WAITING'] } so resolved/snoozed are excluded
      mockPrisma.conversation.findFirst.mockResolvedValue(null);

      const result = await service.findConversation(businessId, 'cust-1');

      expect(result).toBeNull();
      expect(mockPrisma.conversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['OPEN', 'WAITING'] },
          }),
        }),
      );
    });
  });
});

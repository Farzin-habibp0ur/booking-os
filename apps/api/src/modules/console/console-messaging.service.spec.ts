import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConsoleMessagingService } from './console-messaging.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConsoleMessagingService', () => {
  let service: ConsoleMessagingService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        ConsoleMessagingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ConsoleMessagingService);
  });

  describe('getDashboard', () => {
    it('returns aggregated message and reminder stats', async () => {
      prisma.message.findMany.mockResolvedValue([
        { deliveryStatus: 'DELIVERED', direction: 'OUTBOUND' },
        { deliveryStatus: 'READ', direction: 'OUTBOUND' },
        { deliveryStatus: 'FAILED', direction: 'OUTBOUND' },
        { deliveryStatus: 'SENT', direction: 'OUTBOUND' },
        { deliveryStatus: 'DELIVERED', direction: 'INBOUND' },
      ] as any);

      prisma.reminder.findMany.mockResolvedValue([
        { status: 'SENT', sentAt: new Date() },
        { status: 'SENT', sentAt: new Date() },
        { status: 'FAILED', sentAt: null },
      ] as any);

      prisma.conversation.count.mockResolvedValue(5);

      const result = await service.getDashboard();

      expect(result.messagesSent).toBe(4);
      expect(result.messagesDelivered).toBe(2);
      expect(result.messagesFailed).toBe(1);
      expect(result.deliveryRate).toBe(50);
      expect(result.remindersSent).toBe(2);
      expect(result.remindersFailed).toBe(1);
      expect(result.activeConversations).toBe(5);
    });

    it('handles empty data gracefully', async () => {
      prisma.message.findMany.mockResolvedValue([]);
      prisma.reminder.findMany.mockResolvedValue([]);
      prisma.conversation.count.mockResolvedValue(0);

      const result = await service.getDashboard();

      expect(result.messagesSent).toBe(0);
      expect(result.deliveryRate).toBe(0);
      expect(result.remindersSent).toBe(0);
      expect(result.activeConversations).toBe(0);
    });
  });

  describe('getFailures', () => {
    it('groups failures by reason and ranks impacted tenants', async () => {
      const now = new Date();
      prisma.message.findMany.mockResolvedValue([
        { failureReason: 'INVALID_NUMBER', createdAt: now, conversation: { businessId: 'biz1' } },
        { failureReason: 'INVALID_NUMBER', createdAt: now, conversation: { businessId: 'biz1' } },
        { failureReason: 'RATE_LIMITED', createdAt: now, conversation: { businessId: 'biz2' } },
      ] as any);

      prisma.business.findMany.mockResolvedValue([
        { id: 'biz1', name: 'Clinic A' },
        { id: 'biz2', name: 'Clinic B' },
      ] as any);

      const result = await service.getFailures();

      expect(result.topReasons).toHaveLength(2);
      expect(result.topReasons[0].reason).toBe('INVALID_NUMBER');
      expect(result.topReasons[0].count).toBe(2);
      expect(result.impactedTenants).toHaveLength(2);
      expect(result.impactedTenants[0].businessName).toBe('Clinic A');
      expect(result.impactedTenants[0].failureCount).toBe(2);
    });

    it('handles null failure reason', async () => {
      const now = new Date();
      prisma.message.findMany.mockResolvedValue([
        { failureReason: null, createdAt: now, conversation: { businessId: 'biz1' } },
      ] as any);

      prisma.business.findMany.mockResolvedValue([
        { id: 'biz1', name: 'Clinic A' },
      ] as any);

      const result = await service.getFailures();

      expect(result.topReasons[0].reason).toBe('Unknown');
    });

    it('returns empty when no failures', async () => {
      prisma.message.findMany.mockResolvedValue([]);

      const result = await service.getFailures();

      expect(result.topReasons).toEqual([]);
      expect(result.impactedTenants).toEqual([]);
    });
  });

  describe('getWebhookHealth', () => {
    it('returns healthy when failure rate is below 10%', async () => {
      prisma.message.findMany.mockResolvedValue([
        // 11 outbound with 1 failed = 9.09% < 10%
        ...Array.from({ length: 10 }, () => ({ direction: 'OUTBOUND', deliveryStatus: 'DELIVERED' })),
        { direction: 'OUTBOUND', deliveryStatus: 'FAILED' },
        { direction: 'INBOUND', deliveryStatus: 'DELIVERED' },
        { direction: 'INBOUND', deliveryStatus: 'DELIVERED' },
      ] as any);

      const result = await service.getWebhookHealth();

      expect(result.isHealthy).toBe(true);
      expect(result.recentInbound24h).toBe(2);
      expect(result.recentOutbound24h).toBe(11);
      expect(result.failedOutbound24h).toBe(1);
    });

    it('returns unhealthy when failure rate exceeds 10%', async () => {
      prisma.message.findMany.mockResolvedValue([
        { direction: 'OUTBOUND', deliveryStatus: 'DELIVERED' },
        { direction: 'OUTBOUND', deliveryStatus: 'FAILED' },
        { direction: 'OUTBOUND', deliveryStatus: 'FAILED' },
      ] as any);

      const result = await service.getWebhookHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.failedOutbound24h).toBe(2);
    });

    it('returns healthy when no outbound messages', async () => {
      prisma.message.findMany.mockResolvedValue([]);

      const result = await service.getWebhookHealth();

      expect(result.isHealthy).toBe(true);
      expect(result.recentOutbound24h).toBe(0);
    });
  });

  describe('getTenantStatus', () => {
    it('returns per-tenant WhatsApp status and delivery rate', async () => {
      prisma.business.findMany.mockResolvedValue([
        { id: 'biz1', name: 'Clinic A' },
        { id: 'biz2', name: 'Clinic B' },
      ] as any);

      prisma.location.findMany.mockResolvedValue([
        { businessId: 'biz1', whatsappConfig: { phone: '123' }, isActive: true },
        { businessId: 'biz1', whatsappConfig: null, isActive: true },
        { businessId: 'biz2', whatsappConfig: null, isActive: true },
      ] as any);

      const now = new Date();
      prisma.conversation.findMany.mockResolvedValue([
        { businessId: 'biz1', lastMessageAt: now },
      ] as any);

      prisma.message.findMany.mockResolvedValue([
        { deliveryStatus: 'DELIVERED', direction: 'OUTBOUND', conversation: { businessId: 'biz1' } },
        { deliveryStatus: 'FAILED', direction: 'OUTBOUND', conversation: { businessId: 'biz1' } },
      ] as any);

      const result = await service.getTenantStatus();

      expect(result).toHaveLength(2);
      const clinicA = result.find((t) => t.businessId === 'biz1');
      expect(clinicA?.hasWhatsappConfig).toBe(true);
      expect(clinicA?.locationCount).toBe(2);
      expect(clinicA?.configuredLocationCount).toBe(1);
      expect(clinicA?.recentDeliveryRate).toBe(50);
      expect(clinicA?.lastMessageAt).toEqual(now);

      const clinicB = result.find((t) => t.businessId === 'biz2');
      expect(clinicB?.hasWhatsappConfig).toBe(false);
      expect(clinicB?.recentDeliveryRate).toBe(0);
      expect(clinicB?.lastMessageAt).toBe(null);
    });
  });

  describe('getFixChecklist', () => {
    it('generates checklist with all ok items', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        name: 'Test Clinic',
      } as any);

      prisma.location.findMany.mockResolvedValue([
        { whatsappConfig: { phone: '123' } },
      ] as any);

      prisma.message.findMany.mockResolvedValue([
        { deliveryStatus: 'DELIVERED' },
      ] as any);

      prisma.reminder.count.mockResolvedValue(0);
      prisma.conversation.count.mockResolvedValue(3);

      const result = await service.getFixChecklist('biz1');

      expect(result.businessName).toBe('Test Clinic');
      expect(result.items).toHaveLength(4);
      expect(result.items.every((i) => i.status === 'ok')).toBe(true);
    });

    it('generates checklist with error/warning items', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        name: 'Test Clinic',
      } as any);

      prisma.location.findMany.mockResolvedValue([
        { whatsappConfig: null },
      ] as any);

      prisma.message.findMany.mockResolvedValue([]);

      prisma.reminder.count.mockResolvedValue(5);
      prisma.conversation.count.mockResolvedValue(0);

      const result = await service.getFixChecklist('biz1');

      const whatsapp = result.items.find((i) => i.id === 'whatsapp-config');
      expect(whatsapp?.status).toBe('error');

      const messages = result.items.find((i) => i.id === 'recent-messages');
      expect(messages?.status).toBe('warning');

      const reminders = result.items.find((i) => i.id === 'stuck-reminders');
      expect(reminders?.status).toBe('error');

      const conversations = result.items.find((i) => i.id === 'active-conversations');
      expect(conversations?.status).toBe('warning');
    });

    it('throws NotFoundException for invalid business', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.getFixChecklist('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

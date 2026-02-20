import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ConsoleMessagingService {
  private readonly logger = new Logger(ConsoleMessagingService.name);

  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [messages, reminders, activeConversations] = await Promise.all([
      this.prisma.message.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { deliveryStatus: true, direction: true },
      }),
      this.prisma.reminder.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { status: true, sentAt: true },
      }),
      this.prisma.conversation.count({
        where: { status: { in: ['OPEN', 'WAITING'] } },
      }),
    ]);

    const outbound = messages.filter((m) => m.direction === 'OUTBOUND');
    const messagesSent = outbound.length;
    const messagesDelivered = outbound.filter(
      (m) => m.deliveryStatus === 'DELIVERED' || m.deliveryStatus === 'READ',
    ).length;
    const messagesFailed = outbound.filter(
      (m) => m.deliveryStatus === 'FAILED',
    ).length;
    const deliveryRate =
      messagesSent > 0
        ? Math.round((messagesDelivered / messagesSent) * 100)
        : 0;

    const remindersSent = reminders.filter((r) => r.sentAt !== null).length;
    const remindersFailed = reminders.filter(
      (r) => r.status === 'FAILED',
    ).length;
    const reminderSuccessRate =
      reminders.length > 0
        ? Math.round(
            ((remindersSent - remindersFailed) / reminders.length) * 100,
          )
        : 0;

    return {
      messagesSent,
      messagesDelivered,
      messagesFailed,
      deliveryRate,
      remindersSent,
      remindersFailed,
      reminderSuccessRate,
      activeConversations,
    };
  }

  async getFailures(limit = 10) {
    const failedMessages = await this.prisma.message.findMany({
      where: { deliveryStatus: 'FAILED' },
      select: {
        failureReason: true,
        createdAt: true,
        conversation: {
          select: { businessId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by failure reason
    const reasonMap = new Map<string, number>();
    for (const msg of failedMessages) {
      const reason = msg.failureReason || 'Unknown';
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    }

    const topReasons = Array.from(reasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    // Group by tenant
    const tenantMap = new Map<
      string,
      { failureCount: number; totalMessages: number; lastFailure: Date }
    >();
    for (const msg of failedMessages) {
      const bizId = msg.conversation.businessId;
      const existing = tenantMap.get(bizId) || {
        failureCount: 0,
        totalMessages: 0,
        lastFailure: msg.createdAt,
      };
      existing.failureCount++;
      if (msg.createdAt > existing.lastFailure) {
        existing.lastFailure = msg.createdAt;
      }
      tenantMap.set(bizId, existing);
    }

    const impactedBizIds = Array.from(tenantMap.keys());
    let businesses: { id: string; name: string }[] = [];
    if (impactedBizIds.length > 0) {
      businesses = await this.prisma.business.findMany({
        where: { id: { in: impactedBizIds } },
        select: { id: true, name: true },
      });
    }

    const businessMap = new Map(businesses.map((b) => [b.id, b.name]));

    const impactedTenants = Array.from(tenantMap.entries())
      .map(([businessId, data]) => ({
        businessId,
        businessName: businessMap.get(businessId) || 'Unknown',
        failureCount: data.failureCount,
        lastFailure: data.lastFailure,
      }))
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, limit);

    return { topReasons, impactedTenants };
  }

  async getWebhookHealth() {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const recentMessages = await this.prisma.message.findMany({
      where: { createdAt: { gte: twentyFourHoursAgo } },
      select: { direction: true, deliveryStatus: true },
    });

    const recentInbound24h = recentMessages.filter(
      (m) => m.direction === 'INBOUND',
    ).length;
    const recentOutbound24h = recentMessages.filter(
      (m) => m.direction === 'OUTBOUND',
    ).length;
    const failedOutbound24h = recentMessages.filter(
      (m) => m.direction === 'OUTBOUND' && m.deliveryStatus === 'FAILED',
    ).length;

    const isHealthy =
      recentOutbound24h === 0 ||
      failedOutbound24h / recentOutbound24h < 0.1;

    return {
      isHealthy,
      recentInbound24h,
      recentOutbound24h,
      failedOutbound24h,
    };
  }

  async getTenantStatus() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [businesses, locations, conversations] = await Promise.all([
      this.prisma.business.findMany({
        select: { id: true, name: true },
      }),
      this.prisma.location.findMany({
        select: { businessId: true, whatsappConfig: true, isActive: true },
      }),
      this.prisma.conversation.findMany({
        where: { lastMessageAt: { gte: sevenDaysAgo } },
        select: { businessId: true, lastMessageAt: true },
        orderBy: { lastMessageAt: 'desc' },
      }),
    ]);

    const recentMessages = await this.prisma.message.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: {
        deliveryStatus: true,
        direction: true,
        conversation: { select: { businessId: true } },
      },
    });

    return businesses.map((business) => {
      const bizLocations = locations.filter(
        (l) => l.businessId === business.id && l.isActive,
      );
      const configuredLocations = bizLocations.filter(
        (l) => l.whatsappConfig !== null,
      );
      const bizMessages = recentMessages.filter(
        (m) => m.conversation.businessId === business.id && m.direction === 'OUTBOUND',
      );
      const delivered = bizMessages.filter(
        (m) =>
          m.deliveryStatus === 'DELIVERED' || m.deliveryStatus === 'READ',
      ).length;
      const bizConversation = conversations.find(
        (c) => c.businessId === business.id,
      );

      return {
        businessId: business.id,
        businessName: business.name,
        hasWhatsappConfig: configuredLocations.length > 0,
        locationCount: bizLocations.length,
        configuredLocationCount: configuredLocations.length,
        recentDeliveryRate:
          bizMessages.length > 0
            ? Math.round((delivered / bizMessages.length) * 100)
            : 0,
        lastMessageAt: bizConversation?.lastMessageAt || null,
      };
    });
  }

  async getFixChecklist(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [locations, recentMessages, stuckReminders, activeConversations] =
      await Promise.all([
        this.prisma.location.findMany({
          where: { businessId, isActive: true },
          select: { whatsappConfig: true },
        }),
        this.prisma.message.findMany({
          where: {
            conversation: { businessId },
            createdAt: { gte: sevenDaysAgo },
            direction: 'OUTBOUND',
          },
          select: { deliveryStatus: true },
        }),
        this.prisma.reminder.count({
          where: {
            businessId,
            status: 'PENDING',
            scheduledAt: { lte: oneHourAgo },
          },
        }),
        this.prisma.conversation.count({
          where: { businessId, status: { in: ['OPEN', 'WAITING'] } },
        }),
      ]);

    const hasWhatsappConfig = locations.some((l) => l.whatsappConfig !== null);
    const hasSuccessfulMessages = recentMessages.some(
      (m) => m.deliveryStatus === 'DELIVERED' || m.deliveryStatus === 'READ',
    );
    const hasStuckReminders = stuckReminders > 0;
    const hasActiveConversations = activeConversations > 0;

    const items = [
      {
        id: 'whatsapp-config',
        label: 'WhatsApp configuration',
        status: hasWhatsappConfig ? 'ok' : 'error',
        description: hasWhatsappConfig
          ? 'At least one location has WhatsApp configured'
          : 'No locations have WhatsApp configured — messages cannot be sent',
      },
      {
        id: 'recent-messages',
        label: 'Recent message delivery',
        status: hasSuccessfulMessages ? 'ok' : 'warning',
        description: hasSuccessfulMessages
          ? 'Messages have been successfully delivered in the last 7 days'
          : 'No successful message deliveries in the last 7 days',
      },
      {
        id: 'stuck-reminders',
        label: 'Reminder processing',
        status: hasStuckReminders ? 'error' : 'ok',
        description: hasStuckReminders
          ? `${stuckReminders} reminder(s) have been stuck in PENDING for over 1 hour`
          : 'All reminders are processing normally',
      },
      {
        id: 'active-conversations',
        label: 'Active conversations',
        status: hasActiveConversations ? 'ok' : 'warning',
        description: hasActiveConversations
          ? `${activeConversations} active conversation(s) open`
          : 'No active conversations — this may indicate messaging is not being used',
      },
    ];

    return { businessName: business.name, items };
  }
}

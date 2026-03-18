import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { ConsoleMessagingService } from './console-messaging.service';
import { PlatformAuditService } from './platform-audit.service';
import { CurrentUser } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';

@ApiTags('Console - Messaging')
@Controller('admin/messaging-console')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class ConsoleMessagingController {
  constructor(
    private messagingService: ConsoleMessagingService,
    private auditService: PlatformAuditService,
    private prisma: PrismaService,
  ) {}

  @Get('dashboard')
  async getDashboard(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.messagingService.getDashboard();

    this.auditService.log(user.sub, user.email, 'MESSAGING_DASHBOARD_VIEW');

    return result;
  }

  @Get('failures')
  async getFailures(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.messagingService.getFailures();

    this.auditService.log(user.sub, user.email, 'MESSAGING_FAILURES_VIEW');

    return result;
  }

  @Get('webhook-health')
  async getWebhookHealth(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.messagingService.getWebhookHealth();

    this.auditService.log(user.sub, user.email, 'MESSAGING_WEBHOOK_HEALTH_VIEW');

    return result;
  }

  @Get('tenant-status')
  async getTenantStatus(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.messagingService.getTenantStatus();

    this.auditService.log(user.sub, user.email, 'MESSAGING_TENANT_STATUS_VIEW');

    return result;
  }

  @Get('tenant/:businessId/fix-checklist')
  async getFixChecklist(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.messagingService.getFixChecklist(businessId);

    this.auditService.log(user.sub, user.email, 'MESSAGING_FIX_CHECKLIST_VIEW', {
      targetType: 'BUSINESS',
      targetId: businessId,
    });

    return result;
  }

  /**
   * Seed Instagram mock conversations for testing.
   * POST /admin/messaging-console/seed-instagram-test
   */
  @Post('seed-instagram-test')
  async seedInstagramTest(@CurrentUser() user: { sub: string; email: string }) {
    const business = await this.prisma.business.findUnique({
      where: { slug: 'glow-aesthetic' },
    });
    if (!business) return { error: 'Glow Aesthetic Clinic not found' };

    const existing = await this.prisma.customer.findFirst({
      where: { businessId: business.id, instagramUserId: { not: null } },
    });
    if (existing) return { skipped: true, message: 'Instagram test data already exists' };

    const staff = await this.prisma.staff.findFirst({
      where: { businessId: business.id, role: 'ADMIN' },
    });
    const location = await this.prisma.location.findFirst({
      where: { businessId: business.id, isActive: true },
    });

    const bizId = business.id;
    const now = new Date();
    const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);
    const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

    // Customer 1: Sophia — story reply
    const sophia = await this.prisma.customer.create({
      data: {
        businessId: bizId,
        name: 'Sophia Rivera',
        phone: 'ig:sophia_beauty_vibes',
        instagramUserId: 'sophia_beauty_vibes',
        tags: ['instagram', 'new-lead'],
      },
    });
    const convo1 = await this.prisma.conversation.create({
      data: {
        businessId: bizId,
        customerId: sophia.id,
        assignedToId: staff?.id,
        channel: 'INSTAGRAM',
        status: 'OPEN',
        lastMessageAt: minutesAgo(12),
        tags: ['story-reply'],
        locationId: location?.id,
      },
    });
    await this.prisma.message.createMany({
      data: [
        {
          conversationId: convo1.id,
          direction: 'INBOUND',
          content: 'OMG your before/after results are amazing! How much is Botox?',
          contentType: 'TEXT',
          externalId: `mid.ig_sophia_1_${Date.now()}`,
          metadata: { storyReplyUrl: 'https://instagram.com/stories/glowclinic/123' },
          createdAt: minutesAgo(45),
        },
        {
          conversationId: convo1.id,
          direction: 'OUTBOUND',
          senderStaffId: staff?.id,
          content:
            'Thank you so much, Sophia! We love sharing our results. Botox starts at $12/unit. Would you like to book a free consultation?',
          contentType: 'TEXT',
          externalId: `mid.ig_sophia_2_${Date.now()}`,
          createdAt: minutesAgo(30),
        },
        {
          conversationId: convo1.id,
          direction: 'INBOUND',
          content:
            "Yes please! Do you have anything available this week? I'm free Thursday or Friday afternoon.",
          contentType: 'TEXT',
          externalId: `mid.ig_sophia_3_${Date.now()}`,
          createdAt: minutesAgo(12),
        },
      ],
    });

    // Customer 2: Jake — ad referral, unassigned
    const jake = await this.prisma.customer.create({
      data: {
        businessId: bizId,
        name: 'Jake Thompson',
        phone: 'ig:jake.t.fitness',
        instagramUserId: 'jake.t.fitness',
        tags: ['instagram', 'ad-lead'],
      },
    });
    const convo2 = await this.prisma.conversation.create({
      data: {
        businessId: bizId,
        customerId: jake.id,
        channel: 'INSTAGRAM',
        status: 'OPEN',
        lastMessageAt: hoursAgo(3),
        tags: ['ad-lead'],
        locationId: location?.id,
      },
    });
    await this.prisma.message.createMany({
      data: [
        {
          conversationId: convo2.id,
          direction: 'INBOUND',
          content: 'Saw your ad for the summer skin package. What does it include?',
          contentType: 'TEXT',
          externalId: `mid.ig_jake_1_${Date.now()}`,
          metadata: { referral: { source: 'ADS', type: 'OPEN_THREAD' } },
          createdAt: hoursAgo(3),
        },
      ],
    });

    // Customer 3: Mia — ice breaker booking
    const mia = await this.prisma.customer.create({
      data: {
        businessId: bizId,
        name: 'Mia Chen',
        phone: 'ig:mia.glow.journey',
        instagramUserId: 'mia.glow.journey',
        tags: ['instagram', 'VIP'],
      },
    });
    const convo3 = await this.prisma.conversation.create({
      data: {
        businessId: bizId,
        customerId: mia.id,
        assignedToId: staff?.id,
        channel: 'INSTAGRAM',
        status: 'WAITING',
        lastMessageAt: minutesAgo(90),
        tags: ['VIP', 'booking'],
        locationId: location?.id,
      },
    });
    await this.prisma.message.createMany({
      data: [
        {
          conversationId: convo3.id,
          direction: 'INBOUND',
          content: 'Book an appointment',
          contentType: 'TEXT',
          externalId: `mid.ig_mia_1_${Date.now()}`,
          metadata: { postback: 'book_appointment' },
          createdAt: hoursAgo(2),
        },
        {
          conversationId: convo3.id,
          direction: 'OUTBOUND',
          senderStaffId: staff?.id,
          content:
            "Hi Mia! I'd love to help you book. What treatment are you interested in? We have Botox, fillers, chemical peels, and microneedling.",
          contentType: 'TEXT',
          externalId: `mid.ig_mia_2_${Date.now()}`,
          createdAt: minutesAgo(110),
        },
        {
          conversationId: convo3.id,
          direction: 'INBOUND',
          content: "I'm interested in lip filler! I've never had it done before.",
          contentType: 'TEXT',
          externalId: `mid.ig_mia_3_${Date.now()}`,
          createdAt: minutesAgo(100),
        },
        {
          conversationId: convo3.id,
          direction: 'OUTBOUND',
          senderStaffId: staff?.id,
          content:
            'Great choice! Yes, we always do a consultation first. Our next available is Thursday at 3pm or Friday at 10am. Which works?',
          contentType: 'TEXT',
          externalId: `mid.ig_mia_4_${Date.now()}`,
          createdAt: minutesAgo(90),
        },
      ],
    });

    // Customer 4: Liam — window almost expired
    const liam = await this.prisma.customer.create({
      data: {
        businessId: bizId,
        name: 'Liam Parker',
        phone: 'ig:liam_p_92',
        instagramUserId: 'liam_p_92',
        tags: ['instagram'],
      },
    });
    const convo4 = await this.prisma.conversation.create({
      data: {
        businessId: bizId,
        customerId: liam.id,
        channel: 'INSTAGRAM',
        status: 'OPEN',
        lastMessageAt: hoursAgo(23),
        tags: ['needs-attention'],
        locationId: location?.id,
      },
    });
    await this.prisma.message.createMany({
      data: [
        {
          conversationId: convo4.id,
          direction: 'INBOUND',
          content:
            'Do you guys do PRP for hair? My friend got it done somewhere and said it works great',
          contentType: 'TEXT',
          externalId: `mid.ig_liam_1_${Date.now()}`,
          createdAt: hoursAgo(23),
        },
      ],
    });

    this.auditService.log(user.sub, user.email, 'SEED_INSTAGRAM_TEST');

    return {
      ok: true,
      created: {
        customers: 4,
        conversations: 4,
        details: [
          'Sophia Rivera (@sophia_beauty_vibes) — story reply, active window',
          'Jake Thompson (@jake.t.fitness) — ad referral, unassigned',
          'Mia Chen (@mia.glow.journey) — ice breaker, waiting for reply',
          'Liam Parker (@liam_p_92) — window expiring (<1h left)',
        ],
      },
    };
  }
}

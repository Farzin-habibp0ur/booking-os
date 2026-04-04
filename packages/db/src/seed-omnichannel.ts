import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_SLUGS = ['glow-aesthetic'] as const;

const CHANNELS = ['WHATSAPP', 'INSTAGRAM', 'SMS', 'EMAIL', 'FACEBOOK', 'WEB_CHAT'] as const;
const DIRECTIONS = ['INBOUND', 'OUTBOUND'] as const;

/** Realistic daily message volume ranges per channel */
const CHANNEL_VOLUME: Record<string, [number, number]> = {
  WHATSAPP: [40, 80],
  INSTAGRAM: [10, 25],
  SMS: [5, 15],
  EMAIL: [20, 40],
  FACEBOOK: [3, 8],
  WEB_CHAT: [15, 30],
};

/** Per-channel per-direction rates for cost computation */
const CHANNEL_RATES: Record<string, { inbound: number; outbound: number }> = {
  SMS: { inbound: 0.0075, outbound: 0.0079 },
  MMS: { inbound: 0.02, outbound: 0.02 },
  EMAIL: { inbound: 0.00065, outbound: 0.00065 },
  WHATSAPP: { inbound: 0, outbound: 0 },
  INSTAGRAM: { inbound: 0, outbound: 0 },
  FACEBOOK: { inbound: 0, outbound: 0 },
  WEB_CHAT: { inbound: 0, outbound: 0 },
};

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

export function computeSegmentsAndCost(
  channel: string,
  direction: string,
  count: number,
): { segments: number; cost: number } {
  const segments = channel === 'SMS' ? randomBetween(1, 3) : 0;
  const rate = CHANNEL_RATES[channel]?.[direction.toLowerCase() as 'inbound' | 'outbound'] || 0;
  const cost = count * (segments || 1) * rate;
  return { segments, cost };
}

export { CHANNEL_RATES };

async function main() {
  console.log('🌐 Seeding omnichannel demo data...');

  // ── 1. Look up demo businesses ──────────────────────────────────────

  const businesses: { id: string; name: string; slug: string }[] = [];

  for (const slug of DEMO_SLUGS) {
    const biz = await prisma.business.findFirst({ where: { slug } });
    if (!biz) {
      console.log(`⚠️  Business "${slug}" not found — skipping.`);
      continue;
    }
    businesses.push(biz);
    console.log(`📌 Found business: ${biz.name} (${biz.id})`);
  }

  if (businesses.length === 0) {
    console.log('⚠️  No demo businesses found. Run the base seed first.');
    return;
  }

  // ── 2. Create multi-channel customers for the aesthetic clinic ──────

  const aesthetic = businesses.find((b) => b.slug === 'glow-aesthetic');

  if (aesthetic) {
    console.log('\n── Multi-channel customers (Glow Aesthetic Clinic) ──');

    const alexCustomer = await prisma.customer.upsert({
      where: {
        businessId_phone: { businessId: aesthetic.id, phone: '+1555MULTI01' },
      },
      update: {
        email: 'alex@example.com',
        instagramUserId: 'ig_alex_mc',
        facebookPsid: 'fb_alex_mc',
      },
      create: {
        businessId: aesthetic.id,
        name: 'Alex Multi-Channel',
        phone: '+1555MULTI01',
        email: 'alex@example.com',
        instagramUserId: 'ig_alex_mc',
        facebookPsid: 'fb_alex_mc',
        tags: ['omnichannel', 'VIP'],
      },
    });
    console.log(`  ✅ Alex Multi-Channel (${alexCustomer.id})`);

    const jordanCustomer = await prisma.customer.upsert({
      where: {
        businessId_phone: {
          businessId: aesthetic.id,
          phone: 'email:jordan@example.com',
        },
      },
      update: { email: 'jordan@example.com' },
      create: {
        businessId: aesthetic.id,
        name: 'Jordan Email-Only',
        phone: 'email:jordan@example.com',
        email: 'jordan@example.com',
        tags: ['email-only'],
      },
    });
    console.log(`  ✅ Jordan Email-Only (${jordanCustomer.id})`);

    const taylorCustomer = await prisma.customer.upsert({
      where: {
        businessId_phone: {
          businessId: aesthetic.id,
          phone: 'web:wc_taylor_001',
        },
      },
      update: { webChatSessionId: 'wc_taylor_001' },
      create: {
        businessId: aesthetic.id,
        name: 'Taylor WebChat',
        phone: 'web:wc_taylor_001',
        webChatSessionId: 'wc_taylor_001',
        tags: ['web-chat'],
      },
    });
    console.log(`  ✅ Taylor WebChat (${taylorCustomer.id})`);

    // ── 2b. Create Conversations and Messages ────────────────────────

    console.log('\n── Conversations and Messages (Glow Aesthetic Clinic) ──');

    // Look up the customers we just created
    const alex = await prisma.customer.findFirst({
      where: { businessId: aesthetic.id, phone: '+1555MULTI01' },
    });
    const jordan = await prisma.customer.findFirst({
      where: { businessId: aesthetic.id, email: 'jordan@example.com' },
    });
    const taylor = await prisma.customer.findFirst({
      where: { businessId: aesthetic.id, webChatSessionId: 'wc_taylor_001' },
    });

    if (alex) {
      // Alex — WhatsApp conversation (5 messages)
      let waConv = await prisma.conversation.findFirst({
        where: {
          businessId: aesthetic.id,
          customerId: alex.id,
          channel: 'WHATSAPP',
        },
      });
      if (!waConv) {
        waConv = await prisma.conversation.create({
          data: {
            businessId: aesthetic.id,
            customerId: alex.id,
            channel: 'WHATSAPP',
            status: 'OPEN',
            lastMessageAt: new Date(),
          },
        });
      }

      const waMessages = [
        {
          direction: 'INBOUND',
          content: 'Hi, I would like to book a consultation',
          externalId: 'seed_wa_alex_1',
        },
        {
          direction: 'OUTBOUND',
          content: 'Hello Alex! We would love to help. What treatment are you interested in?',
          externalId: 'seed_wa_alex_2',
        },
        {
          direction: 'INBOUND',
          content: 'I am interested in Botox. Do you have availability this week?',
          externalId: 'seed_wa_alex_3',
        },
        {
          direction: 'OUTBOUND',
          content: 'We have openings on Thursday at 2pm and Friday at 10am. Which works better?',
          externalId: 'seed_wa_alex_4',
        },
        {
          direction: 'INBOUND',
          content: 'Thursday at 2pm works perfectly!',
          externalId: 'seed_wa_alex_5',
        },
      ];

      for (const msg of waMessages) {
        await prisma.message.upsert({
          where: { externalId: msg.externalId },
          update: {},
          create: {
            conversationId: waConv.id,
            direction: msg.direction,
            content: msg.content,
            contentType: 'TEXT',
            channel: 'WHATSAPP',
            externalId: msg.externalId,
          },
        });
      }
      console.log(`  ✅ Alex WhatsApp: ${waMessages.length} messages`);

      // Alex — Instagram conversation (3 messages)
      let igConv = await prisma.conversation.findFirst({
        where: {
          businessId: aesthetic.id,
          customerId: alex.id,
          channel: 'INSTAGRAM',
        },
      });
      if (!igConv) {
        igConv = await prisma.conversation.create({
          data: {
            businessId: aesthetic.id,
            customerId: alex.id,
            channel: 'INSTAGRAM',
            status: 'OPEN',
            lastMessageAt: new Date(),
          },
        });
      }

      const igMessages = [
        {
          direction: 'INBOUND',
          content: 'Love your before/after photos!',
          externalId: 'seed_ig_alex_1',
        },
        {
          direction: 'OUTBOUND',
          content: 'Thank you so much! Would you like to book a consult?',
          externalId: 'seed_ig_alex_2',
        },
        {
          direction: 'INBOUND',
          content: 'Yes please! Can I book through here?',
          externalId: 'seed_ig_alex_3',
        },
      ];

      for (const msg of igMessages) {
        await prisma.message.upsert({
          where: { externalId: msg.externalId },
          update: {},
          create: {
            conversationId: igConv.id,
            direction: msg.direction,
            content: msg.content,
            contentType: 'TEXT',
            channel: 'INSTAGRAM',
            externalId: msg.externalId,
          },
        });
      }
      console.log(`  ✅ Alex Instagram: ${igMessages.length} messages`);
    }

    if (jordan) {
      // Jordan — Email conversation with subject and threading
      let emailConv = await prisma.conversation.findFirst({
        where: {
          businessId: aesthetic.id,
          customerId: jordan.id,
          channel: 'EMAIL',
        },
      });
      if (!emailConv) {
        emailConv = await prisma.conversation.create({
          data: {
            businessId: aesthetic.id,
            customerId: jordan.id,
            channel: 'EMAIL',
            status: 'WAITING',
            lastMessageAt: new Date(),
            metadata: { subject: 'Appointment inquiry - Lip filler' },
          },
        });
      }

      const emailMessages = [
        {
          direction: 'INBOUND',
          content:
            'Hi, I am interested in lip filler treatment. Could you send me pricing and available dates?',
          externalId: 'seed_email_jordan_1',
          metadata: {
            subject: 'Appointment inquiry - Lip filler',
            messageId: '<seed1@example.com>',
          },
        },
        {
          direction: 'OUTBOUND',
          content:
            'Thank you for reaching out! Our lip filler starts at $500. We have availability next Tuesday and Thursday.',
          externalId: 'seed_email_jordan_2',
          metadata: {
            subject: 'Re: Appointment inquiry - Lip filler',
            inReplyTo: '<seed1@example.com>',
            messageId: '<seed2@glowclinic.com>',
          },
        },
        {
          direction: 'INBOUND',
          content: 'Tuesday works great. Is there anything I need to prepare beforehand?',
          externalId: 'seed_email_jordan_3',
          metadata: {
            subject: 'Re: Appointment inquiry - Lip filler',
            inReplyTo: '<seed2@glowclinic.com>',
            messageId: '<seed3@example.com>',
          },
        },
      ];

      for (const msg of emailMessages) {
        await prisma.message.upsert({
          where: { externalId: msg.externalId },
          update: {},
          create: {
            conversationId: emailConv.id,
            direction: msg.direction,
            content: msg.content,
            contentType: 'TEXT',
            channel: 'EMAIL',
            externalId: msg.externalId,
            metadata: msg.metadata,
          },
        });
      }
      console.log(`  ✅ Jordan Email: ${emailMessages.length} messages (threaded)`);
    }

    if (taylor) {
      // Taylor — Web Chat with offline form message
      let wcConv = await prisma.conversation.findFirst({
        where: {
          businessId: aesthetic.id,
          customerId: taylor.id,
          channel: 'WEB_CHAT',
        },
      });
      if (!wcConv) {
        wcConv = await prisma.conversation.create({
          data: {
            businessId: aesthetic.id,
            customerId: taylor.id,
            channel: 'WEB_CHAT',
            status: 'OPEN',
            lastMessageAt: new Date(),
          },
        });
      }

      const wcMessages: {
        direction: string;
        content: string;
        externalId: string;
        metadata?: Prisma.InputJsonValue;
      }[] = [
        {
          direction: 'INBOUND',
          content:
            '[Offline Form] Hi, I visited your website and wanted to ask about your skincare packages.',
          externalId: 'seed_wc_taylor_1',
          metadata: { offlineForm: true, email: 'taylor@example.com' },
        },
        {
          direction: 'OUTBOUND',
          content:
            'Hi Taylor! Thanks for reaching out. We offer several skincare packages. Would you like to schedule a free consultation?',
          externalId: 'seed_wc_taylor_2',
        },
      ];

      for (const msg of wcMessages) {
        await prisma.message.upsert({
          where: { externalId: msg.externalId },
          update: {},
          create: {
            conversationId: wcConv.id,
            direction: msg.direction,
            content: msg.content,
            contentType: 'TEXT',
            channel: 'WEB_CHAT',
            externalId: msg.externalId,
            ...(msg.metadata && { metadata: msg.metadata }),
          },
        });
      }
      console.log(`  ✅ Taylor WebChat: ${wcMessages.length} messages (with offline form)`);
    }
  }

  // ── 3. Create MessageUsage records for the past 7 days ─────────────

  console.log('\n── MessageUsage records (past 7 days) ──');

  for (const biz of businesses) {
    let recordCount = 0;

    for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
      const date = pastDate(daysAgo);

      for (const channel of CHANNELS) {
        const [min, max] = CHANNEL_VOLUME[channel];

        for (const direction of DIRECTIONS) {
          // Outbound is typically 60-80% of inbound
          const adjustedMin = direction === 'OUTBOUND' ? Math.round(min * 0.6) : min;
          const adjustedMax = direction === 'OUTBOUND' ? Math.round(max * 0.8) : max;
          const count = randomBetween(adjustedMin, adjustedMax);

          const { segments, cost } = computeSegmentsAndCost(channel, direction, count);

          await prisma.messageUsage.upsert({
            where: {
              businessId_channel_direction_date: {
                businessId: biz.id,
                channel,
                direction,
                date,
              },
            },
            update: { count, segments, cost },
            create: {
              businessId: biz.id,
              channel,
              direction,
              date,
              count,
              segments,
              cost,
            },
          });

          recordCount++;
        }
      }
    }

    console.log(`  ✅ ${biz.name}: ${recordCount} MessageUsage records upserted`);
  }

  // ── 4. Set channelSettings on demo businesses ──────────────────────

  console.log('\n── Channel settings ──');

  for (const biz of businesses) {
    await prisma.business.update({
      where: { id: biz.id },
      data: {
        channelSettings: {
          enabledChannels: ['WHATSAPP', 'INSTAGRAM', 'SMS', 'EMAIL', 'FACEBOOK', 'WEB_CHAT'],
          defaultReplyChannel: 'WHATSAPP',
          autoDetectChannel: true,
        },
      },
    });
    console.log(`  ✅ ${biz.name}: channelSettings updated`);
  }

  console.log('\n✅ Omnichannel seed complete');
}

// Only run when executed directly (not when imported by tests)
if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Omnichannel seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

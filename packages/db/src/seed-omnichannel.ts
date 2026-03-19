import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_SLUGS = ['glow-aesthetic', 'metro-auto-group', 'serenity-wellness-spa'] as const;

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

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

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

          await prisma.messageUsage.upsert({
            where: {
              businessId_channel_direction_date: {
                businessId: biz.id,
                channel,
                direction,
                date,
              },
            },
            update: { count },
            create: {
              businessId: biz.id,
              channel,
              direction,
              date,
              count,
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

main()
  .catch((e) => {
    console.error('❌ Omnichannel seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

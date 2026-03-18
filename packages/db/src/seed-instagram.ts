import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📸 Seeding Instagram mock data...');

  // Find Glow Aesthetic Clinic
  const business = await prisma.business.findUnique({
    where: { slug: 'glow-aesthetic' },
  });
  if (!business) {
    console.error('Glow Aesthetic Clinic not found. Run base seed first.');
    process.exit(1);
  }

  // Find a staff member to assign conversations to
  const staff = await prisma.staff.findFirst({
    where: { businessId: business.id, role: 'ADMIN' },
  });

  // Find a location
  const location = await prisma.location.findFirst({
    where: { businessId: business.id, isActive: true },
  });

  // Check if already seeded
  const existingIgCustomer = await prisma.customer.findFirst({
    where: { businessId: business.id, instagramUserId: { not: null } },
  });
  if (existingIgCustomer) {
    console.log('Instagram mock data already seeded. Skipping.');
    return;
  }

  const bizId = business.id;
  const now = new Date();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

  // ── Create Instagram customers ────────────────────────────────────────

  const igSophia = await prisma.customer.create({
    data: {
      businessId: bizId,
      name: 'Sophia Rivera',
      phone: 'ig:sophia_beauty_vibes',
      instagramUserId: 'sophia_beauty_vibes',
      tags: ['instagram', 'new-lead'],
    },
  });

  const igJake = await prisma.customer.create({
    data: {
      businessId: bizId,
      name: 'Jake Thompson',
      phone: 'ig:jake.t.fitness',
      instagramUserId: 'jake.t.fitness',
      tags: ['instagram', 'ad-lead'],
    },
  });

  const igMia = await prisma.customer.create({
    data: {
      businessId: bizId,
      name: 'Mia Chen',
      phone: 'ig:mia.glow.journey',
      instagramUserId: 'mia.glow.journey',
      tags: ['instagram', 'VIP'],
    },
  });

  const igLiam = await prisma.customer.create({
    data: {
      businessId: bizId,
      name: 'Liam Parker',
      phone: 'ig:liam_p_92',
      instagramUserId: 'liam_p_92',
      tags: ['instagram'],
    },
  });

  // ── Conversation 1: Sophia — Story reply, active window ───────────────

  const convo1 = await prisma.conversation.create({
    data: {
      businessId: bizId,
      customerId: igSophia.id,
      assignedToId: staff?.id,
      channel: 'INSTAGRAM',
      status: 'OPEN',
      lastMessageAt: minutesAgo(12),
      tags: ['story-reply'],
      locationId: location?.id,
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: convo1.id,
        direction: 'INBOUND',
        content: 'OMG your before/after results are amazing! How much is Botox?',
        contentType: 'TEXT',
        externalId: 'mid.ig_sophia_1',
        metadata: { storyReplyUrl: 'https://instagram.com/stories/glowclinic/123' },
        createdAt: minutesAgo(45),
      },
      {
        conversationId: convo1.id,
        direction: 'OUTBOUND',
        senderStaffId: staff?.id,
        content:
          'Thank you so much, Sophia! We love sharing our results 😊 Botox starts at $12/unit, and most areas are 20-40 units. Would you like to book a free consultation?',
        contentType: 'TEXT',
        externalId: 'mid.ig_sophia_2',
        createdAt: minutesAgo(30),
      },
      {
        conversationId: convo1.id,
        direction: 'INBOUND',
        content:
          "Yes please! Do you have anything available this week? I'm free Thursday or Friday afternoon.",
        contentType: 'TEXT',
        externalId: 'mid.ig_sophia_3',
        createdAt: minutesAgo(12),
      },
    ],
  });

  // ── Conversation 2: Jake — Ad referral, needs response ────────────────

  const convo2 = await prisma.conversation.create({
    data: {
      businessId: bizId,
      customerId: igJake.id,
      channel: 'INSTAGRAM',
      status: 'OPEN',
      lastMessageAt: hoursAgo(3),
      tags: ['ad-lead', 'urgent'],
      locationId: location?.id,
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: convo2.id,
        direction: 'INBOUND',
        content: 'Saw your ad for the summer skin package. What does it include?',
        contentType: 'TEXT',
        externalId: 'mid.ig_jake_1',
        metadata: {
          referral: { source: 'ADS', type: 'OPEN_THREAD' },
        },
        createdAt: hoursAgo(3),
      },
    ],
  });

  // ── Conversation 3: Mia — Ice breaker, active convo ───────────────────

  const convo3 = await prisma.conversation.create({
    data: {
      businessId: bizId,
      customerId: igMia.id,
      assignedToId: staff?.id,
      channel: 'INSTAGRAM',
      status: 'WAITING',
      lastMessageAt: minutesAgo(90),
      tags: ['VIP', 'booking'],
      locationId: location?.id,
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: convo3.id,
        direction: 'INBOUND',
        content: 'Book an appointment',
        contentType: 'TEXT',
        externalId: 'mid.ig_mia_1',
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
        externalId: 'mid.ig_mia_2',
        createdAt: minutesAgo(110),
      },
      {
        conversationId: convo3.id,
        direction: 'INBOUND',
        content:
          "I'm interested in lip filler! I've never had it done before. Is there a consultation first?",
        contentType: 'TEXT',
        externalId: 'mid.ig_mia_3',
        createdAt: minutesAgo(100),
      },
      {
        conversationId: convo3.id,
        direction: 'OUTBOUND',
        senderStaffId: staff?.id,
        content:
          'Great choice! Yes, we always do a consultation first so Dr. Chen can discuss your goals and create a personalized plan. Our next available consult is Thursday at 3pm or Friday at 10am. Which works for you?',
        contentType: 'TEXT',
        externalId: 'mid.ig_mia_4',
        createdAt: minutesAgo(90),
      },
    ],
  });

  // ── Conversation 4: Liam — Expired window (23+ hours) ────────────────

  const convo4 = await prisma.conversation.create({
    data: {
      businessId: bizId,
      customerId: igLiam.id,
      channel: 'INSTAGRAM',
      status: 'OPEN',
      lastMessageAt: hoursAgo(23),
      tags: ['needs-attention'],
      locationId: location?.id,
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: convo4.id,
        direction: 'INBOUND',
        content:
          'Do you guys do PRP for hair? My friend got it done somewhere and said it works great',
        contentType: 'TEXT',
        externalId: 'mid.ig_liam_1',
        createdAt: hoursAgo(23),
      },
    ],
  });

  console.log('✅ Instagram mock data seeded:');
  console.log(`   - 4 Instagram customers created`);
  console.log(`   - Sophia Rivera (@sophia_beauty_vibes) — story reply, active window`);
  console.log(`   - Jake Thompson (@jake.t.fitness) — ad referral, unassigned`);
  console.log(`   - Mia Chen (@mia.glow.journey) — ice breaker booking, waiting`);
  console.log(`   - Liam Parker (@liam_p_92) — window expiring (<1h left)`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

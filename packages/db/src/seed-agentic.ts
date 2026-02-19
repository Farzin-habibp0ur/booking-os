/**
 * seed-agentic.ts — One-time script to populate agentic demo data in production.
 *
 * Context: The original seed-demo.ts set demoSeeded=true BEFORE the agentic tables
 * existed (ActionHistory, AutonomyConfig, OutboundDraft, AgentConfig). This script
 * fills those gaps without touching existing data.
 *
 * Also cleans up the empty duplicate "metro-auto-group" business.
 *
 * Usage:
 *   DATABASE_URL="..." npx tsx packages/db/src/seed-agentic.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

async function main() {
  console.log('🤖 Seeding agentic demo data...\n');

  // ── 0. Clean up duplicate Metro Auto Group ────────────────────────────────
  const dupMetro = await prisma.business.findFirst({ where: { slug: 'metro-auto-group' } });
  if (dupMetro) {
    // Only delete if it's truly empty (no staff, services, customers)
    const dupStaff = await prisma.staff.count({ where: { businessId: dupMetro.id } });
    const dupSvcs = await prisma.service.count({ where: { businessId: dupMetro.id } });
    const dupCusts = await prisma.customer.count({ where: { businessId: dupMetro.id } });
    if (dupStaff === 0 && dupSvcs === 0 && dupCusts === 0) {
      // Delete any orphaned child records (locations → resources, working hours, etc.)
      const dupLocs = await prisma.location.findMany({
        where: { businessId: dupMetro.id },
        select: { id: true },
      });
      for (const loc of dupLocs) {
        await prisma.resource.deleteMany({ where: { locationId: loc.id } });
      }
      await prisma.location.deleteMany({ where: { businessId: dupMetro.id } });
      await prisma.business.delete({ where: { id: dupMetro.id } });
      console.log(
        '🗑️  Deleted empty duplicate business "metro-auto-group" (and orphan locations/resources)',
      );
    } else {
      console.log(
        `⚠️  Duplicate "metro-auto-group" has data (${dupStaff} staff, ${dupSvcs} services). Skipping delete.`,
      );
    }
  }

  // ── 1. Look up businesses ─────────────────────────────────────────────────
  const glow = await prisma.business.findFirst({ where: { slug: 'glow-aesthetic' } });
  const metro = await prisma.business.findFirst({ where: { slug: 'metro-auto' } });
  if (!glow) throw new Error('Glow Clinic not found');
  if (!metro) throw new Error('Metro Auto not found');

  // ── 2. AutonomyConfig (skip if already exists) ────────────────────────────
  const existingAutonomy = await prisma.autonomyConfig.count();
  if (existingAutonomy === 0) {
    // Glow Clinic configs
    const glowStaff = await prisma.staff.findMany({ where: { businessId: glow.id } });
    const sarah = glowStaff.find((s) => s.email === 'sarah@glowclinic.com');

    await prisma.autonomyConfig.createMany({
      data: [
        // Glow Clinic
        {
          businessId: glow.id,
          actionType: 'DEPOSIT_PENDING',
          autonomyLevel: 'AUTO',
          constraints: { maxPerDay: 10 },
        },
        {
          businessId: glow.id,
          actionType: 'OVERDUE_REPLY',
          autonomyLevel: 'ASSISTED',
          constraints: { maxPerDay: 20 },
        },
        {
          businessId: glow.id,
          actionType: 'OPEN_SLOT',
          autonomyLevel: 'ASSISTED',
          requiredRole: 'ADMIN',
          constraints: { maxPerDay: 5 },
        },
        // Metro Auto
        {
          businessId: metro.id,
          actionType: 'DEPOSIT_PENDING',
          autonomyLevel: 'ASSISTED',
          constraints: { maxPerDay: 15 },
        },
        {
          businessId: metro.id,
          actionType: 'OVERDUE_REPLY',
          autonomyLevel: 'AUTO',
          constraints: { maxPerDay: 30 },
        },
        {
          businessId: metro.id,
          actionType: 'OPEN_SLOT',
          autonomyLevel: 'OFF',
          constraints: {},
        },
      ],
    });
    console.log('✅ 6 autonomy configs created (3 per business)');
  } else {
    console.log(`⏭️  Autonomy configs already exist (${existingAutonomy}). Skipping.`);
  }

  // ── 3. ActionHistory entries ──────────────────────────────────────────────
  const existingHistory = await prisma.actionHistory.count();
  if (existingHistory === 0) {
    const glowStaff = await prisma.staff.findMany({ where: { businessId: glow.id } });
    const sarah = glowStaff.find((s) => s.email === 'sarah@glowclinic.com');
    const maria = glowStaff.find((s) => s.email === 'maria@glowclinic.com');

    const glowCards = await prisma.actionCard.findMany({
      where: { businessId: glow.id },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    const glowBookings = await prisma.booking.findMany({
      where: { businessId: glow.id },
      take: 2,
      orderBy: { createdAt: 'desc' },
    });

    const metroStaff = await prisma.staff.findMany({ where: { businessId: metro.id } });
    const mike = metroStaff.find((s) => s.email === 'mike@metroauto.com');

    const metroCards = await prisma.actionCard.findMany({
      where: { businessId: metro.id },
      take: 2,
      orderBy: { createdAt: 'desc' },
    });

    const metroBookings = await prisma.booking.findMany({
      where: { businessId: metro.id },
      take: 2,
      orderBy: { createdAt: 'desc' },
    });

    const historyData: any[] = [];

    // Glow Clinic history
    if (glowCards.length > 0) {
      historyData.push({
        businessId: glow.id,
        actorType: 'AI',
        actorName: 'System',
        action: 'CARD_CREATED',
        entityType: 'ACTION_CARD',
        entityId: glowCards[0].id,
        description: `Created ${glowCards[0].type.toLowerCase().replace('_', ' ')} card: ${glowCards[0].title}`,
        createdAt: hoursAgo(4),
      });
    }
    if (glowCards.length > 1) {
      historyData.push({
        businessId: glow.id,
        actorType: 'AI',
        actorName: 'System',
        action: 'CARD_CREATED',
        entityType: 'ACTION_CARD',
        entityId: glowCards[1].id,
        description: `Created ${glowCards[1].type.toLowerCase().replace('_', ' ')} card: ${glowCards[1].title}`,
        createdAt: hoursAgo(3),
      });
    }
    if (maria) {
      historyData.push({
        businessId: glow.id,
        actorType: 'STAFF',
        actorId: maria.id,
        actorName: 'Maria',
        action: 'CARD_APPROVED',
        entityType: 'ACTION_CARD',
        entityId: glowCards[0]?.id || 'demo-card-placeholder',
        description: 'Approved and executed deposit reminder card',
        createdAt: hoursAgo(2),
      });
    }
    if (sarah && glowBookings.length > 0) {
      historyData.push({
        businessId: glow.id,
        actorType: 'STAFF',
        actorId: sarah.id,
        actorName: 'Sarah',
        action: 'BOOKING_CREATED',
        entityType: 'BOOKING',
        entityId: glowBookings[0].id,
        description: 'Created appointment via dashboard',
        createdAt: daysAgo(1),
      });
      historyData.push({
        businessId: glow.id,
        actorType: 'AI',
        actorName: 'System',
        action: 'BOOKING_STATUS_CHANGED',
        entityType: 'BOOKING',
        entityId: glowBookings[0].id,
        description: 'Booking confirmed after deposit received',
        diff: { before: { status: 'PENDING_DEPOSIT' }, after: { status: 'CONFIRMED' } },
        createdAt: daysAgo(1),
      });
    }

    // Metro Auto history
    if (metroCards.length > 0) {
      historyData.push({
        businessId: metro.id,
        actorType: 'AI',
        actorName: 'System',
        action: 'CARD_CREATED',
        entityType: 'ACTION_CARD',
        entityId: metroCards[0].id,
        description: `Created ${metroCards[0].type.toLowerCase().replace('_', ' ')} card: ${metroCards[0].title}`,
        createdAt: hoursAgo(5),
      });
    }
    if (mike && metroBookings.length > 0) {
      historyData.push({
        businessId: metro.id,
        actorType: 'STAFF',
        actorId: mike.id,
        actorName: 'Mike',
        action: 'BOOKING_CREATED',
        entityType: 'BOOKING',
        entityId: metroBookings[0].id,
        description: 'Created service appointment from walk-in',
        createdAt: daysAgo(2),
      });
    }

    if (historyData.length > 0) {
      await prisma.actionHistory.createMany({ data: historyData });
      console.log(`✅ ${historyData.length} action history entries created`);
    }
  } else {
    console.log(`⏭️  Action history already exists (${existingHistory}). Skipping.`);
  }

  // ── 4. OutboundDraft entries ──────────────────────────────────────────────
  const existingDrafts = await prisma.outboundDraft.count();
  if (existingDrafts === 0) {
    const glowStaff = await prisma.staff.findMany({ where: { businessId: glow.id } });
    const sarah = glowStaff.find((s) => s.email === 'sarah@glowclinic.com');
    const maria = glowStaff.find((s) => s.email === 'maria@glowclinic.com');

    const glowCustomers = await prisma.customer.findMany({
      where: { businessId: glow.id },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    const draftData: any[] = [];

    if (maria && glowCustomers.length > 0) {
      draftData.push({
        businessId: glow.id,
        customerId: glowCustomers[0].id,
        staffId: maria.id,
        channel: 'WHATSAPP',
        content: `Hi ${glowCustomers[0].name}! Just a reminder that your deposit is still pending for your upcoming appointment. You can pay via the link we sent. Let me know if you need help!`,
        status: 'DRAFT',
      });
    }
    if (sarah && glowCustomers.length > 1) {
      draftData.push({
        businessId: glow.id,
        customerId: glowCustomers[1].id,
        staffId: sarah.id,
        channel: 'WHATSAPP',
        content: `Hi ${glowCustomers[1].name}! It was great meeting you at your consultation. I wanted to follow up — we have availability next week if you'd like to proceed.`,
        status: 'APPROVED',
        approvedById: sarah.id,
      });
    }

    if (draftData.length > 0) {
      await prisma.outboundDraft.createMany({ data: draftData });
      console.log(`✅ ${draftData.length} outbound drafts created`);
    }
  } else {
    console.log(`⏭️  Outbound drafts already exist (${existingDrafts}). Skipping.`);
  }

  // ── 5. AgentConfig entries ────────────────────────────────────────────────
  const existingAgentConfigs = await prisma.agentConfig.count();
  if (existingAgentConfigs === 0) {
    await prisma.agentConfig.createMany({
      data: [
        // Glow Clinic agents
        {
          businessId: glow.id,
          agentType: 'WAITLIST',
          isEnabled: true,
          autonomyLevel: 'SUGGEST',
          config: { maxMatchesPerRun: 5, minConfidence: 0.7 },
          roleVisibility: ['ADMIN', 'AGENT'],
        },
        {
          businessId: glow.id,
          agentType: 'RETENTION',
          isEnabled: true,
          autonomyLevel: 'SUGGEST',
          config: { lookbackDays: 90, minVisits: 2 },
          roleVisibility: ['ADMIN'],
        },
        {
          businessId: glow.id,
          agentType: 'DATA_HYGIENE',
          isEnabled: true,
          autonomyLevel: 'REQUIRE_APPROVAL',
          config: { minConfidence: 0.8 },
          roleVisibility: ['ADMIN'],
        },
        {
          businessId: glow.id,
          agentType: 'SCHEDULING_OPTIMIZER',
          isEnabled: false,
          autonomyLevel: 'SUGGEST',
          config: {},
          roleVisibility: ['ADMIN', 'SERVICE_PROVIDER'],
        },
        {
          businessId: glow.id,
          agentType: 'QUOTE_FOLLOWUP',
          isEnabled: true,
          autonomyLevel: 'SUGGEST',
          config: { followUpAfterDays: 3, maxFollowUps: 2 },
          roleVisibility: ['ADMIN', 'AGENT'],
        },
        // Metro Auto agents
        {
          businessId: metro.id,
          agentType: 'WAITLIST',
          isEnabled: true,
          autonomyLevel: 'AUTO',
          config: { maxMatchesPerRun: 10, minConfidence: 0.6 },
          roleVisibility: ['ADMIN', 'AGENT'],
        },
        {
          businessId: metro.id,
          agentType: 'RETENTION',
          isEnabled: true,
          autonomyLevel: 'SUGGEST',
          config: { lookbackDays: 180, minVisits: 1 },
          roleVisibility: ['ADMIN'],
        },
        {
          businessId: metro.id,
          agentType: 'DATA_HYGIENE',
          isEnabled: false,
          autonomyLevel: 'SUGGEST',
          config: {},
          roleVisibility: ['ADMIN'],
        },
        {
          businessId: metro.id,
          agentType: 'QUOTE_FOLLOWUP',
          isEnabled: true,
          autonomyLevel: 'SUGGEST',
          config: { followUpAfterDays: 5, maxFollowUps: 3 },
          roleVisibility: ['ADMIN', 'AGENT'],
        },
      ],
    });
    console.log('✅ 9 agent configs created (5 Glow + 4 Metro)');
  } else {
    console.log(`⏭️  Agent configs already exist (${existingAgentConfigs}). Skipping.`);
  }

  console.log('\n🎉 Agentic demo data seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

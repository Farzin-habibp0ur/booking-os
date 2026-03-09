import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Content pillar seed data — 12 blog posts across 5 pillars.
 * Creates ContentDraft records with APPROVED status for each business,
 * so the content queue has ready-to-publish material.
 */

const PILLAR_MAP: Record<string, string> = {
  'Industry Insights': 'INDUSTRY_INSIGHTS',
  'Product Education': 'PRODUCT_EDUCATION',
  'Customer Success': 'CUSTOMER_SUCCESS',
  'Thought Leadership': 'THOUGHT_LEADERSHIP',
  Technical: 'TECHNICAL',
};

const SEED_CONTENT = [
  // ─── Industry Insights (3) ──────────────────────────────────────────
  {
    title: 'AI-Powered Clinic Management: What Changed in 2026',
    body: 'An overview of how artificial intelligence is transforming day-to-day operations in aesthetic clinics — from automated triage to intelligent scheduling.',
    pillar: 'INDUSTRY_INSIGHTS',
  },
  {
    title: '5 Service Industry Trends Reshaping How Businesses Operate in 2026',
    body: 'From AI-first customer interactions to hyper-personalization, the key trends transforming service businesses this year.',
    pillar: 'INDUSTRY_INSIGHTS',
  },
  {
    title: 'Managing Multiple Locations Without Losing Your Mind',
    body: 'Operational strategies and technology solutions for service businesses expanding to two, five, or twenty locations.',
    pillar: 'INDUSTRY_INSIGHTS',
  },

  // ─── Product Education (3) ──────────────────────────────────────────
  {
    title: 'WhatsApp Business for Appointment Booking: A Complete Guide',
    body: 'How to leverage WhatsApp Business API for automated booking confirmations, reminders, and two-way client communication.',
    pillar: 'PRODUCT_EDUCATION',
  },
  {
    title: 'Optimizing Your Online Booking Page for Higher Conversion Rates',
    body: 'Practical tips for designing an online booking experience that converts visitors into confirmed appointments.',
    pillar: 'PRODUCT_EDUCATION',
  },
  {
    title: 'The Complete Guide to Automated Email Sequences for Service Businesses',
    body: 'How to set up email drip campaigns that onboard new clients, reduce churn, and drive repeat bookings on autopilot.',
    pillar: 'PRODUCT_EDUCATION',
  },

  // ─── Customer Success (2) ──────────────────────────────────────────
  {
    title: 'How One Clinic Reduced No-Shows by 60% with Smart Automation',
    body: 'A case study on how automated reminders, deposit collection, and waitlist management helped an aesthetic clinic dramatically reduce missed appointments.',
    pillar: 'CUSTOMER_SUCCESS',
  },
  {
    title: '5 Client Retention Strategies That Actually Work for Service Businesses',
    body: 'Proven retention tactics from referral programs to automated follow-ups that keep clients coming back and boost lifetime value.',
    pillar: 'CUSTOMER_SUCCESS',
  },

  // ─── Thought Leadership (2) ────────────────────────────────────────
  {
    title: 'The Future of AI in Service Businesses',
    body: 'How artificial intelligence is evolving from simple chatbots to comprehensive business operating systems that handle scheduling, communication, and growth.',
    pillar: 'THOUGHT_LEADERSHIP',
  },
  {
    title: 'Data-Driven Decision Making for Small Service Businesses',
    body: 'How to use the data you already collect to make smarter decisions about staffing, marketing, pricing, and client experience.',
    pillar: 'THOUGHT_LEADERSHIP',
  },

  // ─── Technical (2) ─────────────────────────────────────────────────
  {
    title: 'Building a Multi-Tenant SaaS with Next.js and NestJS',
    body: 'Architecture decisions, tenant isolation patterns, and lessons learned from building a production multi-tenant booking platform.',
    pillar: 'TECHNICAL',
  },
  {
    title: 'Building Real-Time Features with WebSockets in a NestJS Monorepo',
    body: 'Architecture patterns for adding live updates, presence indicators, and collaborative features to a production NestJS application.',
    pillar: 'TECHNICAL',
  },
];

async function main() {
  console.log('📝 Seeding content pillar drafts...\n');

  // Find all businesses to seed content for
  const businesses = await prisma.business.findMany({
    select: { id: true, name: true },
  });

  if (businesses.length === 0) {
    console.log('No businesses found. Run base seed first: npx tsx packages/db/src/seed.ts');
    return;
  }

  let totalCreated = 0;

  for (const business of businesses) {
    console.log(`  Business: ${business.name}`);
    let created = 0;

    for (const content of SEED_CONTENT) {
      // Check if this draft already exists for this business (idempotent)
      const existing = await prisma.contentDraft.findFirst({
        where: {
          businessId: business.id,
          title: content.title,
        },
      });

      if (existing) continue;

      await prisma.contentDraft.create({
        data: {
          businessId: business.id,
          title: content.title,
          body: content.body,
          contentType: 'BLOG_POST',
          channel: 'BLOG',
          pillar: content.pillar,
          status: 'APPROVED',
          metadata: {},
        },
      });

      created++;
    }

    console.log(
      `    → ${created} drafts created (${SEED_CONTENT.length - created} already existed)`,
    );
    totalCreated += created;
  }

  console.log(
    `\n✅ Content seeding complete: ${totalCreated} drafts created across ${businesses.length} business(es)`,
  );
  console.log(`   Pillars covered: ${Object.values(PILLAR_MAP).join(', ')}`);
}

main()
  .catch((e) => {
    console.error('❌ Content seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

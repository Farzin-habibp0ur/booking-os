import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Creates showcase data for the Platform Console:
 * - Super Admin account (platform business)
 * - 6 diverse businesses across verticals with staff, customers, bookings, services
 * - Subscriptions at various plans and billing states
 * - Varied activity levels to demonstrate health indicators (green/yellow/red)
 */
async function main() {
  console.log('Seeding Platform Console showcase data...\n');

  // ── 1. Platform Business + Super Admin ──
  let platformBiz = await prisma.business.findFirst({ where: { slug: 'platform' } });
  if (!platformBiz) {
    platformBiz = await prisma.business.create({
      data: { name: 'Booking OS Platform', slug: 'platform', verticalPack: 'general' },
    });
    console.log('✓ Created platform business:', platformBiz.id);
  } else {
    console.log('• Platform business exists:', platformBiz.id);
  }

  let superAdmin = await prisma.staff.findFirst({
    where: { email: 'admin@businesscommandcentre.com' },
  });
  if (!superAdmin) {
    superAdmin = await prisma.staff.create({
      data: {
        name: 'Platform Admin',
        email: 'admin@businesscommandcentre.com',
        passwordHash: await hashPassword('superadmin123'),
        role: 'SUPER_ADMIN',
        businessId: platformBiz.id,
        emailVerified: true,
      },
    });
    console.log('✓ Created super admin:', superAdmin.email);
  } else {
    console.log('• Super admin exists:', superAdmin.email);
  }

  // ── 2. Showcase Businesses ──
  // Skip existing businesses (Glow Aesthetic, Metro Auto already exist)

  const businesses = [
    {
      slug: 'zen-wellness-spa',
      name: 'Zen Wellness Spa',
      phone: '+14155550201',
      timezone: 'America/New_York',
      verticalPack: 'general',
      plan: 'pro',
      billingStatus: 'active',
      staffCount: 4,
      customerCount: 85,
      bookingDays: { recent7d: 18, recent30d: 62 },
      services: [
        'Swedish Massage',
        'Deep Tissue Massage',
        'Hot Stone Therapy',
        'Aromatherapy',
        'Couples Massage',
      ],
    },
    {
      slug: 'bright-smile-dental',
      name: 'Bright Smile Dental',
      phone: '+14155550202',
      timezone: 'America/Chicago',
      verticalPack: 'general',
      plan: 'pro',
      billingStatus: 'active',
      staffCount: 6,
      customerCount: 210,
      bookingDays: { recent7d: 35, recent30d: 140 },
      services: ['Cleaning', 'Whitening', 'Root Canal', 'Crown Fitting', 'Consultation', 'X-Ray'],
    },
    {
      slug: 'elite-barbershop',
      name: 'Elite Barbershop',
      phone: '+14155550203',
      timezone: 'America/Los_Angeles',
      verticalPack: 'general',
      plan: 'basic',
      billingStatus: 'active',
      staffCount: 3,
      customerCount: 150,
      bookingDays: { recent7d: 25, recent30d: 95 },
      services: ['Classic Cut', 'Fade', 'Beard Trim', 'Hot Towel Shave', 'Kids Cut'],
    },
    {
      slug: 'paws-pet-grooming',
      name: 'Paws & Claws Pet Grooming',
      phone: '+14155550204',
      timezone: 'Europe/London',
      verticalPack: 'general',
      plan: 'basic',
      billingStatus: 'past_due',
      staffCount: 2,
      customerCount: 40,
      bookingDays: { recent7d: 3, recent30d: 18 },
      services: ['Full Groom', 'Bath & Brush', 'Nail Trim', 'De-shedding Treatment'],
    },
    {
      slug: 'harmony-yoga-studio',
      name: 'Harmony Yoga Studio',
      phone: '+14155550205',
      timezone: 'Asia/Tokyo',
      verticalPack: 'general',
      plan: 'basic',
      billingStatus: 'canceled',
      staffCount: 2,
      customerCount: 25,
      bookingDays: { recent7d: 0, recent30d: 0 },
      services: ['Vinyasa Flow', 'Yin Yoga', 'Private Session'],
    },
    {
      slug: 'luxe-beauty-lounge',
      name: 'Luxe Beauty Lounge',
      phone: '+14155550206',
      timezone: 'America/New_York',
      verticalPack: 'aesthetic',
      plan: 'pro',
      billingStatus: 'active',
      staffCount: 5,
      customerCount: 120,
      bookingDays: { recent7d: 12, recent30d: 48 },
      services: [
        'Botox',
        'Filler',
        'Chemical Peel',
        'Microneedling',
        'Laser Hair Removal',
        'Hydrafacial',
      ],
    },
  ];

  for (const biz of businesses) {
    const existing = await prisma.business.findFirst({ where: { slug: biz.slug } });
    if (existing) {
      console.log(`• Business "${biz.name}" already exists, skipping`);
      continue;
    }

    console.log(`\n── Creating "${biz.name}" ──`);

    // Create business
    const business = await prisma.business.create({
      data: {
        name: biz.name,
        slug: biz.slug,
        phone: biz.phone,
        timezone: biz.timezone,
        verticalPack: biz.verticalPack,
        packConfig: { setupComplete: true },
        aiSettings: { enabled: true, autoReplySuggestions: true },
      },
    });
    console.log(`  ✓ Business created: ${business.id}`);

    // Create subscription
    await prisma.subscription.create({
      data: {
        businessId: business.id,
        stripeCustomerId: `cus_showcase_${biz.slug}`,
        stripeSubscriptionId: `sub_showcase_${biz.slug}`,
        plan: biz.plan,
        status: biz.billingStatus,
        currentPeriodEnd:
          biz.billingStatus === 'canceled'
            ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
    });
    console.log(`  ✓ Subscription: ${biz.plan} / ${biz.billingStatus}`);

    // Create staff
    const staffMembers = [];
    const roles = ['ADMIN', 'AGENT', 'SERVICE_PROVIDER', 'SERVICE_PROVIDER'];
    for (let i = 0; i < biz.staffCount; i++) {
      const role = roles[i] || 'SERVICE_PROVIDER';
      const firstName = ['Sarah', 'James', 'Maria', 'David', 'Emily', 'Robert'][i] || `Staff${i}`;
      const lastName = biz.name.split(' ')[0];
      const email = `${firstName.toLowerCase()}@${biz.slug.replace(/-/g, '')}.com`;

      const staff = await prisma.staff.create({
        data: {
          name: `${firstName} ${lastName}`,
          email,
          passwordHash: await hashPassword('password123'),
          role,
          businessId: business.id,
          emailVerified: true,
          isActive: i < biz.staffCount - (biz.billingStatus === 'canceled' ? 1 : 0), // Last staff inactive for canceled
        },
      });
      staffMembers.push(staff);
    }
    console.log(`  ✓ ${staffMembers.length} staff created`);

    // Create services
    const services = [];
    for (const svcName of biz.services) {
      const durationMins = [30, 45, 60, 90][Math.floor(Math.random() * 4)];
      const service = await prisma.service.create({
        data: {
          name: svcName,
          durationMins,
          price: Math.floor(Math.random() * 200 + 30), // $30-$230
          businessId: business.id,
          category: 'General',
        },
      });
      services.push(service);
    }
    console.log(`  ✓ ${services.length} services created`);

    // Create customers
    const customers = [];
    const firstNames = [
      'Emma',
      'Liam',
      'Olivia',
      'Noah',
      'Ava',
      'Elijah',
      'Sophia',
      'Lucas',
      'Isabella',
      'Mason',
      'Mia',
      'Logan',
      'Charlotte',
      'Alexander',
      'Amelia',
      'Ethan',
      'Harper',
      'Aiden',
      'Evelyn',
      'Jacob',
      'Luna',
      'Michael',
      'Camila',
      'Daniel',
      'Gianna',
      'Henry',
      'Abigail',
      'Sebastian',
      'Emily',
      'Jack',
      'Ella',
      'Owen',
      'Elizabeth',
      'Samuel',
      'Sofia',
      'Ryan',
      'Avery',
      'Nathan',
      'Chloe',
      'Caleb',
      'Scarlett',
      'Christian',
      'Penelope',
      'Isaiah',
      'Layla',
      'Thomas',
      'Riley',
      'Aaron',
      'Zoey',
      'Isaac',
    ];
    const lastNames = [
      'Smith',
      'Johnson',
      'Williams',
      'Brown',
      'Jones',
      'Garcia',
      'Miller',
      'Davis',
      'Rodriguez',
      'Martinez',
      'Wilson',
      'Anderson',
      'Taylor',
      'Thomas',
      'Lee',
      'Harris',
      'Clark',
      'Lewis',
      'Robinson',
      'Walker',
    ];

    for (let i = 0; i < Math.min(biz.customerCount, 50); i++) {
      // Cap at 50 for speed
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[i % lastNames.length];
      const customer = await prisma.customer.create({
        data: {
          name: `${fn} ${ln}`,
          email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`,
          phone: `+1415555${String(1000 + i).slice(-4)}`,
          businessId: business.id,
        },
      });
      customers.push(customer);
    }
    console.log(`  ✓ ${customers.length} customers created`);

    // Create bookings (spread across time to demonstrate activity)
    const statuses = ['CONFIRMED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'];
    let bookingCount = 0;

    // Recent 7-day bookings
    for (let i = 0; i < biz.bookingDays.recent7d; i++) {
      const daysAgo = Math.floor(Math.random() * 7);
      const startTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      startTime.setHours(9 + Math.floor(Math.random() * 9), Math.random() > 0.5 ? 0 : 30, 0, 0);
      const service = services[Math.floor(Math.random() * services.length)];
      const staff = staffMembers[Math.floor(Math.random() * staffMembers.length)];
      const customer = customers[Math.floor(Math.random() * customers.length)];

      await prisma.booking.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          serviceId: service.id,
          staffId: staff.id,
          startTime,
          endTime: new Date(startTime.getTime() + (service.durationMins || 60) * 60 * 1000),
          status:
            daysAgo === 0 ? 'CONFIRMED' : statuses[Math.floor(Math.random() * statuses.length)],
        },
      });
      bookingCount++;
    }

    // Older 30-day bookings (8-30 days ago)
    const olderBookings = biz.bookingDays.recent30d - biz.bookingDays.recent7d;
    for (let i = 0; i < olderBookings; i++) {
      const daysAgo = 8 + Math.floor(Math.random() * 23);
      const startTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      startTime.setHours(9 + Math.floor(Math.random() * 9), Math.random() > 0.5 ? 0 : 30, 0, 0);
      const service = services[Math.floor(Math.random() * services.length)];
      const staff = staffMembers[Math.floor(Math.random() * staffMembers.length)];
      const customer = customers[Math.floor(Math.random() * customers.length)];

      await prisma.booking.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          serviceId: service.id,
          staffId: staff.id,
          startTime,
          endTime: new Date(startTime.getTime() + (service.durationMins || 60) * 60 * 1000),
          status: statuses[Math.floor(Math.random() * statuses.length)],
        },
      });
      bookingCount++;
    }
    console.log(`  ✓ ${bookingCount} bookings created`);

    // Create a few conversations
    const conversationCount = Math.min(Math.floor(biz.customerCount / 10), 8);
    for (let i = 0; i < conversationCount; i++) {
      const customer = customers[i];
      if (!customer) continue;
      await prisma.conversation.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          channel: i % 3 === 0 ? 'WHATSAPP' : 'EMAIL',
          status: i === 0 ? 'OPEN' : 'AI_HANDLING',
        },
      });
    }
    console.log(`  ✓ ${conversationCount} conversations created`);

    // Create waitlist entries for active businesses
    if (biz.billingStatus !== 'canceled') {
      const wlCount = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < wlCount; i++) {
        const customer = customers[i + 10]; // Different customers
        const service = services[Math.floor(Math.random() * services.length)];
        if (!customer) continue;
        await prisma.waitlistEntry.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            serviceId: service.id,
            status: 'ACTIVE',
            timeWindowStart: '09:00',
            timeWindowEnd: '17:00',
          },
        });
      }
      console.log(`  ✓ ${wlCount} waitlist entries created`);
    }

    // Create a campaign for pro businesses
    if (biz.plan === 'pro') {
      await prisma.campaign.create({
        data: {
          businessId: business.id,
          name: 'Spring Promotion',
          status: 'SENT',
          filters: {},
          scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          stats: { sent: 50, delivered: 48, opened: 32, clicked: 12 },
        },
      });
      console.log(`  ✓ 1 campaign created`);
    }
  }

  // ── 3. Add subscriptions to existing businesses if missing ──
  const existingBusinesses = await prisma.business.findMany({
    where: { slug: { in: ['glow-aesthetic', 'metro-auto-group'] } },
    include: { subscription: true },
  });

  for (const biz of existingBusinesses) {
    if (!biz.subscription) {
      await prisma.subscription.create({
        data: {
          businessId: biz.id,
          stripeCustomerId: `cus_existing_${biz.slug}`,
          stripeSubscriptionId: `sub_existing_${biz.slug}`,
          plan: 'pro',
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      console.log(`\n✓ Added subscription to "${biz.name}"`);
    }
  }

  console.log('\n🎉 Platform Console showcase data complete!');
  console.log('\nLogin credentials:');
  console.log('  Super Admin: admin@businesscommandcentre.com / superadmin123');
  console.log('\nExpected Console experience:');
  console.log('  - 8+ businesses in directory (2 existing + 6 new)');
  console.log('  - Health: green (Zen, Bright Smile, Elite, Luxe), yellow (Paws), red (Harmony)');
  console.log('  - Plans: mix of basic and pro');
  console.log('  - Billing: active, past_due, canceled');
  console.log('  - View-as: try any business to see their tenant UI');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

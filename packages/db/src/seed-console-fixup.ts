import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fixup script to fill data gaps from partial seed runs:
 * - Zen Wellness Spa: needs services, customers, bookings, conversations, waitlist
 * - Bright Smile Dental: needs conversations, waitlist, campaign
 */
async function main() {
  console.log('Fixing data gaps...\n');

  // ── Zen Wellness Spa ──
  const zen = await prisma.business.findFirst({ where: { slug: 'zen-wellness-spa' } });
  if (!zen) {
    console.log('ERROR: Zen Wellness Spa not found');
    return;
  }

  const zenStaff = await prisma.staff.findMany({ where: { businessId: zen.id } });
  const zenServiceCount = await prisma.service.count({ where: { businessId: zen.id } });

  if (zenServiceCount === 0) {
    console.log('── Filling Zen Wellness Spa ──');

    // Services
    const zenServices = [];
    for (const svc of ['Swedish Massage', 'Deep Tissue Massage', 'Hot Stone Therapy', 'Aromatherapy', 'Couples Massage']) {
      const durationMins = [30, 45, 60, 90][Math.floor(Math.random() * 4)];
      const service = await prisma.service.create({
        data: {
          name: svc,
          durationMins,
          price: Math.floor(Math.random() * 200 + 30),
          businessId: zen.id,
          category: 'General',
        },
      });
      zenServices.push(service);
    }
    console.log(`  ✓ ${zenServices.length} services created`);

    // Customers
    const firstNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Elijah', 'Sophia', 'Lucas', 'Isabella', 'Mason',
      'Mia', 'Logan', 'Charlotte', 'Alexander', 'Amelia', 'Ethan', 'Harper', 'Aiden', 'Evelyn', 'Jacob',
      'Luna', 'Michael', 'Camila', 'Daniel', 'Gianna', 'Henry', 'Abigail', 'Sebastian', 'Emily', 'Jack',
      'Ella', 'Owen', 'Elizabeth', 'Samuel', 'Sofia', 'Ryan', 'Avery', 'Nathan', 'Chloe', 'Caleb',
      'Scarlett', 'Christian', 'Penelope', 'Isaiah', 'Layla', 'Thomas', 'Riley', 'Aaron', 'Zoey', 'Isaac'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
      'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Lee', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker'];

    const zenCustomers = [];
    for (let i = 0; i < 50; i++) {
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[i % lastNames.length];
      const customer = await prisma.customer.create({
        data: {
          name: `${fn} ${ln}`,
          email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@zen-example.com`,
          phone: `+1415556${String(1000 + i).slice(-4)}`,
          businessId: zen.id,
        },
      });
      zenCustomers.push(customer);
    }
    console.log(`  ✓ ${zenCustomers.length} customers created`);

    // Bookings — recent 7d: 18, total 30d: 62
    const statuses = ['CONFIRMED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'];
    let bookingCount = 0;

    for (let i = 0; i < 18; i++) {
      const daysAgo = Math.floor(Math.random() * 7);
      const startTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      startTime.setHours(9 + Math.floor(Math.random() * 9), Math.random() > 0.5 ? 0 : 30, 0, 0);
      const service = zenServices[Math.floor(Math.random() * zenServices.length)];
      const staff = zenStaff[Math.floor(Math.random() * zenStaff.length)];
      const customer = zenCustomers[Math.floor(Math.random() * zenCustomers.length)];

      await prisma.booking.create({
        data: {
          businessId: zen.id,
          customerId: customer.id,
          serviceId: service.id,
          staffId: staff.id,
          startTime,
          endTime: new Date(startTime.getTime() + (service.durationMins || 60) * 60 * 1000),
          status: daysAgo === 0 ? 'CONFIRMED' : statuses[Math.floor(Math.random() * statuses.length)],
        },
      });
      bookingCount++;
    }

    for (let i = 0; i < 44; i++) { // 62 - 18 = 44
      const daysAgo = 8 + Math.floor(Math.random() * 23);
      const startTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      startTime.setHours(9 + Math.floor(Math.random() * 9), Math.random() > 0.5 ? 0 : 30, 0, 0);
      const service = zenServices[Math.floor(Math.random() * zenServices.length)];
      const staff = zenStaff[Math.floor(Math.random() * zenStaff.length)];
      const customer = zenCustomers[Math.floor(Math.random() * zenCustomers.length)];

      await prisma.booking.create({
        data: {
          businessId: zen.id,
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

    // Conversations
    for (let i = 0; i < 8; i++) {
      const customer = zenCustomers[i];
      await prisma.conversation.create({
        data: {
          businessId: zen.id,
          customerId: customer.id,
          channel: i % 3 === 0 ? 'WHATSAPP' : 'EMAIL',
          status: i === 0 ? 'OPEN' : 'AI_HANDLING',
        },
      });
    }
    console.log(`  ✓ 8 conversations created`);

    // Waitlist
    for (let i = 0; i < 4; i++) {
      const customer = zenCustomers[i + 10];
      const service = zenServices[Math.floor(Math.random() * zenServices.length)];
      await prisma.waitlistEntry.create({
        data: {
          businessId: zen.id,
          customerId: customer.id,
          serviceId: service.id,
          status: 'ACTIVE',
          timeWindowStart: '09:00',
          timeWindowEnd: '17:00',
        },
      });
    }
    console.log(`  ✓ 4 waitlist entries created`);

    // Campaign (pro plan)
    await prisma.campaign.create({
      data: {
        businessId: zen.id,
        name: 'Spring Promotion',
        status: 'SENT',
        filters: {},
        scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        stats: { sent: 50, delivered: 48, opened: 32, clicked: 12 },
      },
    });
    console.log(`  ✓ 1 campaign created`);
  } else {
    console.log('• Zen Wellness Spa already has data, skipping');
  }

  // ── Bright Smile Dental ──
  const bright = await prisma.business.findFirst({ where: { slug: 'bright-smile-dental' } });
  if (!bright) {
    console.log('ERROR: Bright Smile Dental not found');
    return;
  }

  const brightConvCount = await prisma.conversation.count({ where: { businessId: bright.id } });
  if (brightConvCount === 0) {
    console.log('\n── Filling Bright Smile Dental gaps ──');

    const brightCustomers = await prisma.customer.findMany({
      where: { businessId: bright.id },
      take: 20,
    });
    const brightServices = await prisma.service.findMany({ where: { businessId: bright.id } });

    // Conversations
    for (let i = 0; i < Math.min(brightCustomers.length, 8); i++) {
      const customer = brightCustomers[i];
      await prisma.conversation.create({
        data: {
          businessId: bright.id,
          customerId: customer.id,
          channel: i % 3 === 0 ? 'WHATSAPP' : 'EMAIL',
          status: i === 0 ? 'OPEN' : 'AI_HANDLING',
        },
      });
    }
    console.log(`  ✓ conversations created`);

    // Waitlist
    for (let i = 0; i < 4; i++) {
      const customer = brightCustomers[i + 10];
      const service = brightServices[Math.floor(Math.random() * brightServices.length)];
      if (!customer || !service) continue;
      await prisma.waitlistEntry.create({
        data: {
          businessId: bright.id,
          customerId: customer.id,
          serviceId: service.id,
          status: 'ACTIVE',
          timeWindowStart: '09:00',
          timeWindowEnd: '17:00',
        },
      });
    }
    console.log(`  ✓ waitlist entries created`);

    // Campaign (pro plan)
    await prisma.campaign.create({
      data: {
        businessId: bright.id,
        name: 'Spring Promotion',
        status: 'SENT',
        filters: {},
        scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        stats: { sent: 120, delivered: 115, opened: 78, clicked: 34 },
      },
    });
    console.log(`  ✓ 1 campaign created`);

    // Add more bookings to reach target (140 total, currently 35)
    const brightStaff = await prisma.staff.findMany({ where: { businessId: bright.id } });
    const currentBookings = await prisma.booking.count({ where: { businessId: bright.id } });
    const needed = 140 - currentBookings;
    if (needed > 0) {
      const statuses = ['CONFIRMED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'];
      // Add recent 7d bookings (target ~35 total in 7d, assume existing 35 are mixed)
      for (let i = 0; i < needed; i++) {
        const daysAgo = 1 + Math.floor(Math.random() * 29);
        const startTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        startTime.setHours(9 + Math.floor(Math.random() * 9), Math.random() > 0.5 ? 0 : 30, 0, 0);
        const service = brightServices[Math.floor(Math.random() * brightServices.length)];
        const staff = brightStaff[Math.floor(Math.random() * brightStaff.length)];
        const customer = brightCustomers[Math.floor(Math.random() * brightCustomers.length)];

        await prisma.booking.create({
          data: {
            businessId: bright.id,
            customerId: customer.id,
            serviceId: service.id,
            staffId: staff.id,
            startTime,
            endTime: new Date(startTime.getTime() + (service.durationMins || 60) * 60 * 1000),
            status: statuses[Math.floor(Math.random() * statuses.length)],
          },
        });
      }
      console.log(`  ✓ ${needed} additional bookings created`);
    }
  } else {
    console.log('• Bright Smile Dental already has data, skipping');
  }

  // ── Add subscriptions to existing businesses if missing ──
  const existingBiz = await prisma.business.findMany({
    where: { slug: { in: ['glow-aesthetic', 'metro-auto-group', 'metro-auto'] } },
    include: { subscription: true },
  });
  for (const biz of existingBiz) {
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

  console.log('\n🎉 Data fixup complete!');
}

main()
  .catch((e) => {
    console.error('Fixup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

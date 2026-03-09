import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Seeds a Wellness Vertical Pack showcase business:
 * - Serenity Wellness Spa (verticalPack: 'wellness')
 * - 3 staff, 6 services, 5 customers with intake data
 */
async function main() {
  console.log('Seeding Wellness Vertical Pack demo data...\n');

  const existing = await prisma.business.findFirst({
    where: { slug: 'serenity-wellness-spa' },
  });
  if (existing) {
    console.log('• Serenity Wellness Spa already exists, skipping');
    return;
  }

  // ── Business ──
  const business = await prisma.business.create({
    data: {
      name: 'Serenity Wellness Spa',
      slug: 'serenity-wellness-spa',
      phone: '+14155550300',
      timezone: 'America/Los_Angeles',
      verticalPack: 'wellness',
      packConfig: {
        setupComplete: true,
        trackProgress: true,
        membershipEnabled: true,
        intakeFormRequired: true,
        requiredProfileFields: ['firstName', 'email'],
      },
      aiSettings: { enabled: true, autoReplySuggestions: true },
    },
  });
  console.log('✓ Business created:', business.id);

  // ── Subscription ──
  await prisma.subscription.create({
    data: {
      businessId: business.id,
      stripeCustomerId: 'cus_serenity_wellness',
      stripeSubscriptionId: 'sub_serenity_wellness',
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log('✓ Subscription: pro / active');

  // ── Staff (3) ──
  const staff = [];
  const staffData = [
    { name: 'Maya Chen', email: 'maya@serenitywellness.com', role: 'ADMIN' },
    { name: 'Jordan Rivera', email: 'jordan@serenitywellness.com', role: 'SERVICE_PROVIDER' },
    { name: 'Aisha Patel', email: 'aisha@serenitywellness.com', role: 'SERVICE_PROVIDER' },
  ];
  for (const s of staffData) {
    const member = await prisma.staff.create({
      data: {
        name: s.name,
        email: s.email,
        passwordHash: await hashPassword('password123'),
        role: s.role,
        businessId: business.id,
        emailVerified: true,
        isActive: true,
      },
    });
    staff.push(member);
  }
  console.log(`✓ ${staff.length} staff created`);

  // ── Services (6) ──
  const services = [];
  const serviceData = [
    { name: 'Initial Wellness Consultation', durationMins: 30, price: 0, category: 'Consultation', kind: 'CONSULT' },
    { name: 'Swedish Massage', durationMins: 60, price: 90, category: 'Massage', kind: 'TREATMENT' },
    { name: 'Deep Tissue Massage', durationMins: 60, price: 110, category: 'Massage', kind: 'TREATMENT' },
    { name: 'Yoga Private Session', durationMins: 60, price: 75, category: 'Yoga', kind: 'TREATMENT' },
    { name: 'Personal Training', durationMins: 60, price: 80, category: 'Training', kind: 'TREATMENT' },
    { name: 'Nutrition Coaching', durationMins: 45, price: 65, category: 'Coaching', kind: 'CONSULT' },
  ];
  for (const svc of serviceData) {
    const service = await prisma.service.create({
      data: {
        name: svc.name,
        durationMins: svc.durationMins,
        price: svc.price,
        category: svc.category,
        businessId: business.id,
      },
    });
    services.push(service);
  }
  console.log(`✓ ${services.length} services created`);

  // ── Customers (5) with wellness intake data ──
  const customers = [];
  const customerData = [
    {
      name: 'Elena Vasquez',
      email: 'elena.v@example.com',
      phone: '+14155551001',
      customFields: {
        healthGoals: 'Reduce chronic back pain and improve flexibility',
        fitnessLevel: 'Intermediate',
        injuries: 'Lower back strain (2024)',
        medications: 'None',
        allergies: 'Lavender oil',
        preferredModality: 'Massage',
        membershipType: 'Monthly',
      },
    },
    {
      name: 'Marcus Thompson',
      email: 'marcus.t@example.com',
      phone: '+14155551002',
      customFields: {
        healthGoals: 'Build strength and lose weight',
        fitnessLevel: 'Beginner',
        injuries: '',
        medications: 'Blood pressure medication',
        allergies: '',
        preferredModality: 'Personal Training',
        membershipType: 'Annual',
      },
    },
    {
      name: 'Suki Yamamoto',
      email: 'suki.y@example.com',
      phone: '+14155551003',
      customFields: {
        healthGoals: 'Stress management and mindfulness',
        fitnessLevel: 'Advanced',
        injuries: '',
        medications: '',
        allergies: '',
        preferredModality: 'Yoga',
        membershipType: 'VIP',
      },
    },
    {
      name: 'David Park',
      email: 'david.p@example.com',
      phone: '+14155551004',
      customFields: {
        healthGoals: 'Recovery from knee surgery',
        fitnessLevel: 'Beginner',
        injuries: 'Right knee ACL reconstruction (Jan 2026)',
        medications: 'Anti-inflammatory',
        allergies: 'Latex',
        preferredModality: 'No Preference',
        membershipType: 'Monthly',
      },
    },
    {
      name: 'Priya Sharma',
      email: 'priya.s@example.com',
      phone: '+14155551005',
      customFields: {
        healthGoals: 'Improve nutrition and energy levels',
        fitnessLevel: 'Intermediate',
        injuries: '',
        medications: '',
        allergies: 'Eucalyptus',
        preferredModality: 'Nutrition',
        membershipType: 'Drop-in',
      },
    },
  ];
  for (const c of customerData) {
    const customer = await prisma.customer.create({
      data: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        businessId: business.id,
        customFields: c.customFields,
      },
    });
    customers.push(customer);
  }
  console.log(`✓ ${customers.length} customers created (with intake data)`);

  // ── Bookings (spread across recent weeks) ──
  const statuses = ['CONFIRMED', 'COMPLETED', 'COMPLETED', 'COMPLETED'];
  let bookingCount = 0;

  for (let i = 0; i < 15; i++) {
    const daysAgo = Math.floor(Math.random() * 21);
    const startTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    startTime.setHours(9 + Math.floor(Math.random() * 9), Math.random() > 0.5 ? 0 : 30, 0, 0);
    const service = services[Math.floor(Math.random() * services.length)];
    const staffMember = staff[1 + Math.floor(Math.random() * 2)]; // providers only
    const customer = customers[Math.floor(Math.random() * customers.length)];

    await prisma.booking.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        serviceId: service.id,
        staffId: staffMember.id,
        startTime,
        endTime: new Date(startTime.getTime() + (service.durationMins || 60) * 60 * 1000),
        status: daysAgo === 0 ? 'CONFIRMED' : statuses[Math.floor(Math.random() * statuses.length)],
      },
    });
    bookingCount++;
  }
  console.log(`✓ ${bookingCount} bookings created`);

  console.log('\n🧘 Serenity Wellness Spa seed complete!');
  console.log('\nLogin: maya@serenitywellness.com / password123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.message.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.conversationNote.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.service.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.business.deleteMany();

  // Create business
  const business = await prisma.business.create({
    data: {
      name: 'Glow Aesthetic Clinic',
      slug: 'glow-aesthetic',
      phone: '+14155550100',
      timezone: 'America/Los_Angeles',
      verticalPack: 'aesthetic',
      packConfig: {
        requireConsultation: true,
        medicalFormRequired: true,
        requiredProfileFields: ['firstName', 'email'],
      },
      aiSettings: {
        enabled: true,
        autoReplySuggestions: true,
        bookingAssistant: true,
        personality: 'friendly and professional',
        autoReply: {
          enabled: false,
          mode: 'all',
          selectedIntents: ['GENERAL', 'BOOK_APPOINTMENT', 'CANCEL', 'RESCHEDULE', 'INQUIRY'],
        },
      },
    },
  });

  console.log(`✅ Business: ${business.name}`);

  // Create staff
  const owner = await prisma.staff.create({
    data: {
      businessId: business.id,
      name: 'Dr. Sarah Chen',
      email: 'sarah@glowclinic.com',
      passwordHash: await hashPassword('password123'),
      role: 'OWNER',
    },
  });

  const agent = await prisma.staff.create({
    data: {
      businessId: business.id,
      name: 'Maria Garcia',
      email: 'maria@glowclinic.com',
      passwordHash: await hashPassword('password123'),
      role: 'AGENT',
    },
  });

  console.log(`✅ Staff: ${owner.name}, ${agent.name}`);

  // Create working hours (Mon-Fri 9am-5pm for owner, Mon-Sat 8am-6pm for agent)
  const workDays = [1, 2, 3, 4, 5]; // Mon-Fri
  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    await prisma.workingHours.create({
      data: {
        staffId: owner.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '17:00',
        isOff: !workDays.includes(day),
      },
    });
    await prisma.workingHours.create({
      data: {
        staffId: agent.id,
        dayOfWeek: day,
        startTime: '08:00',
        endTime: '18:00',
        isOff: day === 0, // Sunday off for agent
      },
    });
  }

  console.log(`✅ Working hours created for both staff`);

  // Create services
  const services = await Promise.all([
    prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Botox Treatment',
        durationMins: 30,
        price: 350,
        category: 'Injectables',
        customFields: { requiresConsultation: true },
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Dermal Filler',
        durationMins: 45,
        price: 500,
        category: 'Injectables',
        customFields: { requiresConsultation: true },
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Chemical Peel',
        durationMins: 60,
        price: 200,
        category: 'Skin Treatments',
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Microneedling',
        durationMins: 45,
        price: 275,
        category: 'Skin Treatments',
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Consultation',
        durationMins: 20,
        price: 0,
        category: 'General',
        customFields: { isConsultation: true },
      },
    }),
  ]);

  console.log(`✅ Services: ${services.length} created`);

  // Create customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'Emma Wilson',
        phone: '+14155550201',
        email: 'emma@example.com',
        tags: ['VIP', 'Regular'],
        customFields: {
          skinType: 'III',
          allergies: 'None known',
          isMedicalFlagged: false,
        },
      },
    }),
    prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'James Thompson',
        phone: '+14155550202',
        tags: ['New'],
        customFields: {
          skinType: 'II',
          allergies: 'Latex',
          isMedicalFlagged: true,
        },
      },
    }),
    prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'Sofia Rodriguez',
        phone: '+14155550203',
        email: 'sofia@example.com',
        tags: ['Regular'],
        customFields: {
          skinType: 'IV',
          allergies: 'None',
          isMedicalFlagged: false,
        },
      },
    }),
  ]);

  console.log(`✅ Customers: ${customers.length} created`);

  // Create message templates
  await Promise.all([
    prisma.messageTemplate.create({
      data: {
        businessId: business.id,
        name: '24h Reminder',
        category: 'REMINDER',
        body: 'Hi {{customerName}}! This is a reminder for your {{serviceName}} appointment tomorrow at {{time}} with {{staffName}} at Glow Aesthetic Clinic. Reply YES to confirm or call us to reschedule.',
        variables: ['customerName', 'serviceName', 'time', 'staffName'],
      },
    }),
    prisma.messageTemplate.create({
      data: {
        businessId: business.id,
        name: 'Booking Confirmation',
        category: 'CONFIRMATION',
        body: 'Your {{serviceName}} has been booked for {{date}} at {{time}} with {{staffName}}. See you at Glow Aesthetic Clinic! ✨',
        variables: ['serviceName', 'date', 'time', 'staffName'],
      },
    }),
    prisma.messageTemplate.create({
      data: {
        businessId: business.id,
        name: 'Follow-up',
        category: 'FOLLOW_UP',
        body: 'Hi {{customerName}}, how are you feeling after your {{serviceName}}? Let us know if you have any questions! 💫',
        variables: ['customerName', 'serviceName'],
      },
    }),
  ]);

  console.log(`✅ Message templates created`);

  // Create some sample conversations and messages
  const conv1 = await prisma.conversation.create({
    data: {
      businessId: business.id,
      customerId: customers[0].id,
      channel: 'WHATSAPP',
      status: 'OPEN',
      lastMessageAt: new Date(),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: conv1.id,
        direction: 'INBOUND',
        content: 'Hi! I\'d like to book a Botox appointment for next week',
        contentType: 'TEXT',
        createdAt: new Date(Date.now() - 3600000),
      },
      {
        conversationId: conv1.id,
        direction: 'OUTBOUND',
        senderStaffId: agent.id,
        content: 'Hello Emma! We\'d love to help you book that. We have availability on Tuesday and Thursday. Which works better for you?',
        contentType: 'TEXT',
        createdAt: new Date(Date.now() - 3000000),
      },
      {
        conversationId: conv1.id,
        direction: 'INBOUND',
        content: 'Thursday at 2pm would be perfect!',
        contentType: 'TEXT',
        createdAt: new Date(Date.now() - 2400000),
      },
    ],
  });

  const conv2 = await prisma.conversation.create({
    data: {
      businessId: business.id,
      customerId: customers[1].id,
      channel: 'WHATSAPP',
      status: 'OPEN',
      lastMessageAt: new Date(Date.now() - 1800000),
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conv2.id,
      direction: 'INBOUND',
      content: 'Hello, I\'m interested in getting a consultation for dermal fillers. What\'s available?',
      contentType: 'TEXT',
    },
  });

  console.log(`✅ Sample conversations and messages created`);

  // Create a sample booking
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);

  const bookingEnd = new Date(tomorrow);
  bookingEnd.setMinutes(bookingEnd.getMinutes() + 30);

  const booking = await prisma.booking.create({
    data: {
      businessId: business.id,
      customerId: customers[2].id,
      serviceId: services[2].id, // Chemical Peel
      staffId: owner.id,
      status: 'CONFIRMED',
      startTime: tomorrow,
      endTime: bookingEnd,
    },
  });

  // Create reminder for the booking
  const reminderTime = new Date(tomorrow);
  reminderTime.setHours(reminderTime.getHours() - 24);

  await prisma.reminder.create({
    data: {
      businessId: business.id,
      bookingId: booking.id,
      scheduledAt: reminderTime,
      status: 'PENDING',
    },
  });

  console.log(`✅ Sample booking and reminder created`);
  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

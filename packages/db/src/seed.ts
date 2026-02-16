import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.payment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.recurringSeries.deleteMany();
  await prisma.conversationNote.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.calendarConnection.deleteMany();
  await prisma.service.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.translation.deleteMany();
  await prisma.aiUsage.deleteMany();
  await prisma.subscription.deleteMany();
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
        phase1: {
          outcomeTracking: true,
          beforeAfterPhotos: true,
          treatmentPlans: true,
          consentForms: true,
          productRecommendations: true,
        },
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
      role: 'ADMIN',
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

  const provider = await prisma.staff.create({
    data: {
      businessId: business.id,
      name: 'Dr. Emily Park',
      email: 'emily@glowclinic.com',
      passwordHash: await hashPassword('password123'),
      role: 'SERVICE_PROVIDER',
    },
  });

  console.log(`✅ Staff: ${owner.name}, ${agent.name}, ${provider.name}`);

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

  // Working hours for provider (Mon-Fri 10am-6pm)
  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    await prisma.workingHours.create({
      data: {
        staffId: provider.id,
        dayOfWeek: day,
        startTime: '10:00',
        endTime: '18:00',
        isOff: !workDays.includes(day),
      },
    });
  }

  console.log(`✅ Working hours created for all staff`);

  // Create services
  const services = await Promise.all([
    prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Botox Treatment',
        durationMins: 30,
        price: 350,
        category: 'Injectables',
        kind: 'TREATMENT',
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
        kind: 'TREATMENT',
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
        kind: 'TREATMENT',
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Microneedling',
        durationMins: 45,
        price: 275,
        category: 'Skin Treatments',
        kind: 'TREATMENT',
      },
    }),
    prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Consultation',
        durationMins: 20,
        price: 0,
        category: 'General',
        kind: 'CONSULT',
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
          allergies: 'None known',
          isMedicalFlagged: false,
          concernArea: 'Fine lines around eyes',
          desiredTreatment: 'Botox',
          budget: '$250-$500',
          preferredProvider: 'Dr. Sarah Chen',
          contraindications: 'None',
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
          allergies: 'Latex',
          isMedicalFlagged: true,
          concernArea: 'Lip volume',
          desiredTreatment: 'Dermal Filler',
          budget: '$500-$1000',
          contraindications: 'Blood thinners',
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
    prisma.messageTemplate.create({
      data: {
        businessId: business.id,
        name: 'Consult Follow-up',
        category: 'CONSULT_FOLLOW_UP',
        body: 'Hi {{customerName}}, we hope your consultation at {{businessName}} was helpful! Ready to move forward with treatment? Book here: {{bookingLink}}',
        variables: ['customerName', 'businessName', 'bookingLink'],
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
        content: "Hi! I'd like to book a Botox appointment for next week",
        contentType: 'TEXT',
        createdAt: new Date(Date.now() - 3600000),
      },
      {
        conversationId: conv1.id,
        direction: 'OUTBOUND',
        senderStaffId: agent.id,
        content:
          "Hello Emma! We'd love to help you book that. We have availability on Tuesday and Thursday. Which works better for you?",
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
      content:
        "Hello, I'm interested in getting a consultation for dermal fillers. What's available?",
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

  // Create a completed CONSULT booking for James Thompson with a pending CONSULT_FOLLOW_UP reminder
  const consultDate = new Date();
  consultDate.setDate(consultDate.getDate() - 1);
  consultDate.setHours(11, 0, 0, 0);

  const consultEnd = new Date(consultDate);
  consultEnd.setMinutes(consultEnd.getMinutes() + 20);

  const consultBooking = await prisma.booking.create({
    data: {
      businessId: business.id,
      customerId: customers[1].id, // James Thompson
      serviceId: services[4].id, // Consultation
      staffId: owner.id,
      status: 'COMPLETED',
      startTime: consultDate,
      endTime: consultEnd,
    },
  });

  const consultFollowUpTime = new Date();
  consultFollowUpTime.setDate(consultFollowUpTime.getDate() + 2);

  await prisma.reminder.create({
    data: {
      businessId: business.id,
      bookingId: consultBooking.id,
      scheduledAt: consultFollowUpTime,
      status: 'PENDING',
      type: 'CONSULT_FOLLOW_UP',
    },
  });

  console.log(`✅ Consult booking and CONSULT_FOLLOW_UP reminder created`);

  // Update business notification settings with consultFollowUpDays
  await prisma.business.update({
    where: { id: business.id },
    data: {
      notificationSettings: {
        channels: 'both',
        followUpDelayHours: 2,
        consultFollowUpDays: 3,
      },
    },
  });

  console.log(`✅ Business notification settings updated`);

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

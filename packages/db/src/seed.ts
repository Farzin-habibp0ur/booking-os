import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('🌱 Seeding database...');

  // Check if aesthetic business already seeded
  const existing = await prisma.business.findUnique({
    where: { slug: 'glow-aesthetic' },
  });
  if (existing) {
    console.log('Aesthetic business already seeded. Skipping aesthetic seed.');
    await seedDealership();
    console.log('\n🎉 Seed complete!');
    return;
  }

  // Create business
  const business = await prisma.business.create({
    data: {
      name: 'Glow Aesthetic Clinic',
      slug: 'glow-aesthetic',
      phone: '+14155550100',
      timezone: 'America/Los_Angeles',
      verticalPack: 'aesthetic',
      packConfig: {
        setupComplete: true,
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
        depositRequired: true,
        depositAmount: 100,
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
    prisma.messageTemplate.create({
      data: {
        businessId: business.id,
        name: 'Aftercare Instructions',
        category: 'AFTERCARE',
        body: 'Hi {{customerName}}, thank you for your {{serviceName}} at {{businessName}}! Here are your aftercare reminders: avoid direct sun exposure, keep the area clean, and contact us if you have any concerns.',
        variables: ['customerName', 'serviceName', 'businessName'],
      },
    }),
    prisma.messageTemplate.create({
      data: {
        businessId: business.id,
        name: 'Treatment Check-in',
        category: 'TREATMENT_CHECK_IN',
        body: "Hi {{customerName}}, it's been 24 hours since your {{serviceName}} at {{businessName}}. How are you feeling? Let us know if you have any questions or concerns.",
        variables: ['customerName', 'serviceName', 'businessName'],
      },
    }),
    prisma.messageTemplate.create({
      data: {
        businessId: business.id,
        name: 'Deposit Request',
        category: 'DEPOSIT_REQUIRED',
        body: 'Hi {{customerName}}, your {{serviceName}} at {{businessName}} on {{date}} at {{time}} requires a deposit of ${{depositAmount}} to confirm your booking. Please complete your payment to secure your appointment.',
        variables: ['customerName', 'serviceName', 'businessName', 'date', 'time', 'depositAmount'],
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

  // Create a completed TREATMENT booking for Emma Wilson with AFTERCARE (SENT) and TREATMENT_CHECK_IN (PENDING)
  const treatmentDate = new Date();
  treatmentDate.setDate(treatmentDate.getDate() - 1);
  treatmentDate.setHours(14, 0, 0, 0);

  const treatmentEnd = new Date(treatmentDate);
  treatmentEnd.setMinutes(treatmentEnd.getMinutes() + 60);

  const treatmentBooking = await prisma.booking.create({
    data: {
      businessId: business.id,
      customerId: customers[0].id, // Emma Wilson
      serviceId: services[2].id, // Chemical Peel
      staffId: owner.id,
      status: 'COMPLETED',
      startTime: treatmentDate,
      endTime: treatmentEnd,
    },
  });

  await prisma.reminder.create({
    data: {
      businessId: business.id,
      bookingId: treatmentBooking.id,
      scheduledAt: treatmentDate,
      status: 'SENT',
      type: 'AFTERCARE',
      sentAt: treatmentDate,
    },
  });

  const checkInTime = new Date();
  checkInTime.setHours(checkInTime.getHours() + 12);

  await prisma.reminder.create({
    data: {
      businessId: business.id,
      bookingId: treatmentBooking.id,
      scheduledAt: checkInTime,
      status: 'PENDING',
      type: 'TREATMENT_CHECK_IN',
    },
  });

  console.log(`✅ Treatment booking with AFTERCARE and TREATMENT_CHECK_IN reminders created`);

  // Create a PENDING_DEPOSIT booking for a new customer
  const depositCustomer = await prisma.customer.create({
    data: {
      businessId: business.id,
      name: 'Liam Parker',
      phone: '+14155550204',
      email: 'liam@example.com',
      tags: ['New'],
    },
  });

  const depositDate = new Date();
  depositDate.setDate(depositDate.getDate() + 3);
  depositDate.setHours(10, 0, 0, 0);

  const depositEnd = new Date(depositDate);
  depositEnd.setMinutes(depositEnd.getMinutes() + 30);

  await prisma.booking.create({
    data: {
      businessId: business.id,
      customerId: depositCustomer.id,
      serviceId: services[0].id, // Botox Treatment (deposit required)
      staffId: owner.id,
      status: 'PENDING_DEPOSIT',
      startTime: depositDate,
      endTime: depositEnd,
    },
  });

  console.log(`✅ PENDING_DEPOSIT booking created for ${depositCustomer.name}`);

  // Update business notification settings with consultFollowUpDays and treatmentCheckInHours
  await prisma.business.update({
    where: { id: business.id },
    data: {
      notificationSettings: {
        channels: 'both',
        followUpDelayHours: 2,
        consultFollowUpDays: 3,
        treatmentCheckInHours: 24,
      },
    },
  });

  console.log(`✅ Business notification settings updated`);

  // Create sample ROI baseline
  const baselineEnd = new Date();
  baselineEnd.setDate(baselineEnd.getDate() - 7);
  const baselineStart = new Date(baselineEnd);
  baselineStart.setDate(baselineStart.getDate() - 7);

  await prisma.roiBaseline.create({
    data: {
      businessId: business.id,
      goLiveDate: baselineEnd,
      baselineStart,
      baselineEnd,
      metrics: {
        noShowRate: 18,
        noShowTotal: 50,
        noShowCount: 9,
        consultConversionRate: 45,
        consultCustomers: 11,
        consultConverted: 5,
        avgResponseMinutes: 12,
        responseSampleSize: 40,
        totalRevenue: 4200,
        completedBookings: 32,
        avgBookingValue: 131.25,
        statusBreakdown: [
          { status: 'COMPLETED', count: 32 },
          { status: 'NO_SHOW', count: 9 },
          { status: 'CANCELLED', count: 5 },
          { status: 'PENDING', count: 4 },
        ],
      },
    },
  });

  console.log(`✅ ROI baseline created`);

  console.log(`✅ Sample booking and reminder created`);

  await seedDealership();

  console.log('\n🎉 Seed complete!');
}


async function seedDealership() {
  const dealershipExists = await prisma.business.findUnique({
    where: { slug: 'metro-auto-group' },
  });

  if (dealershipExists) {
    console.log('Dealership business already seeded. Skipping.');
    return;
  }

  {
    const dealership = await prisma.business.create({
      data: {
        name: 'Metro Auto Group',
        slug: 'metro-auto-group',
        phone: '+14155551000',
        timezone: 'America/New_York',
        verticalPack: 'dealership',
        packConfig: {
          setupComplete: true,
          kanbanEnabled: true,
          kanbanStatuses: ['CHECKED_IN', 'DIAGNOSING', 'AWAITING_APPROVAL', 'IN_PROGRESS', 'READY_FOR_PICKUP'],
        },
        aiSettings: {
          enabled: true,
          autoReplySuggestions: true,
          bookingAssistant: true,
          personality: 'professional and helpful automotive advisor',
          autoReply: {
            enabled: false,
            mode: 'all',
            selectedIntents: ['GENERAL', 'BOOK_APPOINTMENT', 'SALES_INQUIRY', 'SERVICE_APPOINTMENT'],
          },
        },
        notificationSettings: {
          channels: 'both',
          followUpDelayHours: 2,
          consultFollowUpDays: 7,
          treatmentCheckInHours: 48,
        },
      },
    });

    console.log(`✅ Dealership Business: ${dealership.name}`);

    // Create locations
    const showroom = await prisma.location.create({
      data: {
        businessId: dealership.id,
        name: 'Showroom / Sales',
        address: '100 Auto Mall Blvd, Suite A',
        isBookable: true,
        whatsappConfig: {
          phoneNumberId: 'showroom_phone_001',
          displayPhone: '+14155551001',
          webhookVerifyToken: 'showroom_verify_token',
        },
      },
    });

    const spareParts = await prisma.location.create({
      data: {
        businessId: dealership.id,
        name: 'Spare Parts',
        address: '100 Auto Mall Blvd, Suite B',
        isBookable: false,
        whatsappConfig: {
          phoneNumberId: 'parts_phone_002',
          displayPhone: '+14155551002',
          webhookVerifyToken: 'parts_verify_token',
        },
      },
    });

    const serviceCenter = await prisma.location.create({
      data: {
        businessId: dealership.id,
        name: 'Service Center',
        address: '100 Auto Mall Blvd, Suite C',
        isBookable: true,
        whatsappConfig: {
          phoneNumberId: 'service_phone_003',
          displayPhone: '+14155551003',
          webhookVerifyToken: 'service_verify_token',
        },
      },
    });

    const afterSales = await prisma.location.create({
      data: {
        businessId: dealership.id,
        name: 'After-Sales',
        address: '100 Auto Mall Blvd, Suite D',
        isBookable: true,
        whatsappConfig: {
          phoneNumberId: 'aftersales_phone_004',
          displayPhone: '+14155551004',
          webhookVerifyToken: 'aftersales_verify_token',
        },
      },
    });

    console.log(`✅ Locations: ${showroom.name}, ${spareParts.name}, ${serviceCenter.name}, ${afterSales.name}`);

    // Create resources — 8 service bays at Service Center
    for (let i = 1; i <= 8; i++) {
      await prisma.resource.create({
        data: {
          locationId: serviceCenter.id,
          name: `Service Bay ${i}`,
          type: 'service_bay',
          metadata: { capacity: 1, hasLift: i <= 6 },
        },
      });
    }

    // 2 demo vehicles at Showroom
    await prisma.resource.create({
      data: {
        locationId: showroom.id,
        name: 'Demo Vehicle - Sedan',
        type: 'vehicle',
        metadata: { make: 'Toyota', model: 'Camry', year: 2025 },
      },
    });
    await prisma.resource.create({
      data: {
        locationId: showroom.id,
        name: 'Demo Vehicle - SUV',
        type: 'vehicle',
        metadata: { make: 'Toyota', model: 'RAV4', year: 2025 },
      },
    });

    console.log(`✅ Resources: 8 service bays + 2 demo vehicles`);

    // Create dealership staff
    const dealerAdmin = await prisma.staff.create({
      data: {
        businessId: dealership.id,
        name: 'Mike Johnson',
        email: 'mike@metroauto.com',
        passwordHash: await hashPassword('password123'),
        role: 'ADMIN',
      },
    });

    const salesRep1 = await prisma.staff.create({
      data: {
        businessId: dealership.id,
        name: 'Alex Rivera',
        email: 'alex@metroauto.com',
        passwordHash: await hashPassword('password123'),
        role: 'AGENT',
      },
    });

    const salesRep2 = await prisma.staff.create({
      data: {
        businessId: dealership.id,
        name: 'Dana Kim',
        email: 'dana@metroauto.com',
        passwordHash: await hashPassword('password123'),
        role: 'AGENT',
      },
    });

    const mechanic1 = await prisma.staff.create({
      data: {
        businessId: dealership.id,
        name: 'Carlos Mendez',
        email: 'carlos@metroauto.com',
        passwordHash: await hashPassword('password123'),
        role: 'SERVICE_PROVIDER',
      },
    });

    const mechanic2 = await prisma.staff.create({
      data: {
        businessId: dealership.id,
        name: 'James Wright',
        email: 'james@metroauto.com',
        passwordHash: await hashPassword('password123'),
        role: 'SERVICE_PROVIDER',
      },
    });

    const mechanic3 = await prisma.staff.create({
      data: {
        businessId: dealership.id,
        name: 'Priya Patel',
        email: 'priya@metroauto.com',
        passwordHash: await hashPassword('password123'),
        role: 'SERVICE_PROVIDER',
      },
    });

    const mechanic4 = await prisma.staff.create({
      data: {
        businessId: dealership.id,
        name: 'Tom Baker',
        email: 'tom@metroauto.com',
        passwordHash: await hashPassword('password123'),
        role: 'SERVICE_PROVIDER',
      },
    });

    console.log(`✅ Dealership Staff: 1 admin, 2 sales reps, 4 mechanics`);

    // Working hours for dealership staff (Mon-Sat 8am-6pm)
    const allDealershipStaff = [dealerAdmin, salesRep1, salesRep2, mechanic1, mechanic2, mechanic3, mechanic4];
    for (const s of allDealershipStaff) {
      for (const day of [0, 1, 2, 3, 4, 5, 6]) {
        await prisma.workingHours.create({
          data: {
            staffId: s.id,
            dayOfWeek: day,
            startTime: '08:00',
            endTime: '18:00',
            isOff: day === 0, // Sunday off
          },
        });
      }
    }

    console.log(`✅ Working hours created for all dealership staff`);

    // Assign staff to locations via StaffLocation
    // Sales reps → Showroom
    await prisma.staffLocation.createMany({
      data: [
        { staffId: salesRep1.id, locationId: showroom.id },
        { staffId: salesRep2.id, locationId: showroom.id },
        { staffId: salesRep1.id, locationId: afterSales.id },
        { staffId: salesRep2.id, locationId: afterSales.id },
      ],
    });

    // Mechanics → Service Center
    await prisma.staffLocation.createMany({
      data: [
        { staffId: mechanic1.id, locationId: serviceCenter.id },
        { staffId: mechanic2.id, locationId: serviceCenter.id },
        { staffId: mechanic3.id, locationId: serviceCenter.id },
        { staffId: mechanic4.id, locationId: serviceCenter.id },
      ],
    });

    // Admin → all locations
    await prisma.staffLocation.createMany({
      data: [
        { staffId: dealerAdmin.id, locationId: showroom.id },
        { staffId: dealerAdmin.id, locationId: spareParts.id },
        { staffId: dealerAdmin.id, locationId: serviceCenter.id },
        { staffId: dealerAdmin.id, locationId: afterSales.id },
      ],
    });

    console.log(`✅ Staff-location assignments created`);

    // Create dealership services
    await Promise.all([
      prisma.service.create({
        data: {
          businessId: dealership.id,
          name: 'Test Drive',
          durationMins: 30,
          price: 0,
          category: 'Sales',
          kind: 'CONSULT',
        },
      }),
      prisma.service.create({
        data: {
          businessId: dealership.id,
          name: 'Routine Maintenance',
          durationMins: 60,
          price: 150,
          category: 'Service',
          kind: 'TREATMENT',
        },
      }),
      prisma.service.create({
        data: {
          businessId: dealership.id,
          name: 'Brake Service',
          durationMins: 90,
          price: 350,
          category: 'Service',
          kind: 'TREATMENT',
        },
      }),
      prisma.service.create({
        data: {
          businessId: dealership.id,
          name: 'Oil Change',
          durationMins: 30,
          price: 75,
          category: 'Service',
          kind: 'TREATMENT',
        },
      }),
      prisma.service.create({
        data: {
          businessId: dealership.id,
          name: 'Diagnostic Check',
          durationMins: 45,
          price: 100,
          category: 'Service',
          kind: 'CONSULT',
        },
      }),
    ]);

    console.log(`✅ Dealership services created`);

    // Create dealership message templates
    await Promise.all([
      prisma.messageTemplate.create({
        data: {
          businessId: dealership.id,
          name: 'Car Ready for Pickup',
          category: 'CUSTOM',
          body: 'Hi {{customerName}}, your {{vehicleInfo}} is ready for pickup at Metro Auto Group! Total: ${{totalAmount}}. Please visit our Service Center to collect your vehicle.',
          variables: ['customerName', 'vehicleInfo', 'totalAmount'],
        },
      }),
      prisma.messageTemplate.create({
        data: {
          businessId: dealership.id,
          name: 'Service Status Update',
          category: 'CUSTOM',
          body: 'Hi {{customerName}}, here\'s an update on your {{vehicleInfo}}: {{statusUpdate}}. If you have questions, reply to this message.',
          variables: ['customerName', 'vehicleInfo', 'statusUpdate'],
        },
      }),
      prisma.messageTemplate.create({
        data: {
          businessId: dealership.id,
          name: 'Quote Approval Request',
          category: 'CUSTOM',
          body: 'Hi {{customerName}}, we have a quote ready for your {{vehicleInfo}}. Total: ${{totalAmount}}. Please review and approve here: {{approvalLink}}',
          variables: ['customerName', 'vehicleInfo', 'totalAmount', 'approvalLink'],
        },
      }),
      prisma.messageTemplate.create({
        data: {
          businessId: dealership.id,
          name: '6-Month Maintenance Nudge',
          category: 'FOLLOW_UP',
          body: 'Hi {{customerName}}, it\'s been 6 months since your last service at Metro Auto Group. Time for a check-up! Book your next appointment: {{bookingLink}}',
          variables: ['customerName', 'bookingLink'],
        },
      }),
      prisma.messageTemplate.create({
        data: {
          businessId: dealership.id,
          name: 'Test Drive Confirmation',
          category: 'CONFIRMATION',
          body: 'Your test drive for the {{vehicleInfo}} is confirmed for {{date}} at {{time}} at our Showroom. See you there!',
          variables: ['vehicleInfo', 'date', 'time'],
        },
      }),
    ]);

    console.log(`✅ Dealership message templates created`);

    // Create sample dealership customers
    await Promise.all([
      prisma.customer.create({
        data: {
          businessId: dealership.id,
          name: 'Robert Chen',
          phone: '+14155552001',
          email: 'robert@example.com',
          tags: ['VIP'],
          customFields: {
            make: 'Toyota',
            model: 'Camry',
            year: 2022,
            vin: '1HGBH41JXMN109186',
            mileage: 35000,
            interestType: 'Service',
          },
        },
      }),
      prisma.customer.create({
        data: {
          businessId: dealership.id,
          name: 'Lisa Park',
          phone: '+14155552002',
          email: 'lisa@example.com',
          tags: ['New'],
          customFields: {
            interestType: 'New',
          },
        },
      }),
    ]);

    console.log(`✅ Dealership customers created`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * seed-demo.ts — Populate production with rich, realistic demo data.
 *
 * Idempotent: checks packConfig.demoSeeded flag to prevent double-runs.
 * Resilient: creates missing staff/customers via upsert, fixes service kinds.
 *
 * Usage:
 *   DATABASE_URL="..." npx tsx packages/db/src/seed-demo.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Date helpers ────────────────────────────────────────────────────────────

function daysAgo(n: number, hour = 10, min = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d;
}

function daysFromNow(n: number, hour = 10, min = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, min, 0, 0);
  return d;
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

function addMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60 * 1000);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding demo data...\n');

  // ── 1. Look up existing business ──────────────────────────────────────────
  const business = await prisma.business.findFirst();
  if (!business) {
    throw new Error('No business found. Run the base seed first.');
  }

  // Idempotency guard
  const config = business.packConfig as Record<string, unknown>;
  if (config.demoSeeded) {
    console.log('⏭️  Demo data already seeded (packConfig.demoSeeded=true). Skipping.');
    return;
  }

  const bizId = business.id;

  // ── 2. Ensure correct packConfig (production may be missing phase1 etc.) ──
  await prisma.business.update({
    where: { id: bizId },
    data: {
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
      notificationSettings: {
        channels: 'both',
        followUpDelayHours: 2,
        consultFollowUpDays: 3,
        treatmentCheckInHours: 24,
      },
    },
  });
  console.log('✅ Business config updated');

  // ── 3. Ensure all 3 staff exist ───────────────────────────────────────────
  const allStaff = await prisma.staff.findMany({ where: { businessId: bizId } });
  const sarah = allStaff.find((s) => s.email === 'sarah@glowclinic.com')!;
  const maria = allStaff.find((s) => s.email === 'maria@glowclinic.com')!;

  let emily = allStaff.find((s) => s.email === 'emily@glowclinic.com');
  if (!emily) {
    emily = await prisma.staff.create({
      data: {
        businessId: bizId,
        name: 'Dr. Emily Park',
        email: 'emily@glowclinic.com',
        passwordHash: await bcrypt.hash('password123', 12),
        role: 'SERVICE_PROVIDER',
      },
    });
    // Create working hours for Emily (Mon-Fri 10am-6pm)
    for (const day of [0, 1, 2, 3, 4, 5, 6]) {
      await prisma.workingHours.create({
        data: {
          staffId: emily.id,
          dayOfWeek: day,
          startTime: '10:00',
          endTime: '18:00',
          isOff: ![1, 2, 3, 4, 5].includes(day),
        },
      });
    }
    console.log('✅ Created missing staff: Dr. Emily Park');
  }

  // ── 4. Fix service kinds (production may have all "OTHER") ────────────────
  const allServices = await prisma.service.findMany({ where: { businessId: bizId } });
  const kindMap: Record<string, string> = {
    'Botox Treatment': 'TREATMENT',
    'Dermal Filler': 'TREATMENT',
    'Chemical Peel': 'TREATMENT',
    'Microneedling': 'TREATMENT',
    'Consultation': 'CONSULT',
  };
  for (const svc of allServices) {
    const expected = kindMap[svc.name];
    if (expected && svc.kind !== expected) {
      await prisma.service.update({ where: { id: svc.id }, data: { kind: expected } });
    }
    // Also fix deposit settings for Botox
    if (svc.name === 'Botox Treatment' && !svc.depositRequired) {
      await prisma.service.update({
        where: { id: svc.id },
        data: { depositRequired: true, depositAmount: 100 },
      });
    }
  }
  console.log('✅ Service kinds verified/fixed');

  const svcBotox = allServices.find((s) => s.name === 'Botox Treatment')!;
  const svcFiller = allServices.find((s) => s.name === 'Dermal Filler')!;
  const svcPeel = allServices.find((s) => s.name === 'Chemical Peel')!;
  const svcMicro = allServices.find((s) => s.name === 'Microneedling')!;
  const svcConsult = allServices.find((s) => s.name === 'Consultation')!;

  // ── 5. Ensure message templates exist ─────────────────────────────────────
  const existingTemplates = await prisma.messageTemplate.findMany({ where: { businessId: bizId } });
  if (existingTemplates.length === 0) {
    await prisma.messageTemplate.createMany({
      data: [
        { businessId: bizId, name: '24h Reminder', category: 'REMINDER', body: 'Hi {{customerName}}! Reminder for your {{serviceName}} tomorrow at {{time}}.', variables: ['customerName', 'serviceName', 'time'] },
        { businessId: bizId, name: 'Booking Confirmation', category: 'CONFIRMATION', body: 'Your {{serviceName}} is booked for {{date}} at {{time}}.', variables: ['serviceName', 'date', 'time'] },
        { businessId: bizId, name: 'Follow-up', category: 'FOLLOW_UP', body: 'Hi {{customerName}}, how are you feeling after your {{serviceName}}?', variables: ['customerName', 'serviceName'] },
        { businessId: bizId, name: 'Consult Follow-up', category: 'CONSULT_FOLLOW_UP', body: 'Hi {{customerName}}, ready to move forward with treatment?', variables: ['customerName'] },
        { businessId: bizId, name: 'Aftercare Instructions', category: 'AFTERCARE', body: 'Hi {{customerName}}, here are your aftercare reminders after {{serviceName}}.', variables: ['customerName', 'serviceName'] },
        { businessId: bizId, name: 'Treatment Check-in', category: 'TREATMENT_CHECK_IN', body: 'Hi {{customerName}}, how are you feeling after your {{serviceName}}?', variables: ['customerName', 'serviceName'] },
        { businessId: bizId, name: 'Deposit Request', category: 'DEPOSIT_REQUIRED', body: 'Hi {{customerName}}, a deposit of ${{depositAmount}} is required.', variables: ['customerName', 'depositAmount'] },
      ],
    });
    console.log('✅ Message templates created');
  }

  // ── 6. Upsert customers (handles partial previous runs) ───────────────────
  async function ensureCustomer(data: {
    name: string; phone: string; email?: string; tags: string[];
    customFields: Record<string, unknown>;
  }) {
    return prisma.customer.upsert({
      where: { businessId_phone: { businessId: bizId, phone: data.phone } },
      update: {}, // don't overwrite if exists
      create: { businessId: bizId, ...data },
    });
  }

  // Original base customers
  const emma = await ensureCustomer({ name: 'Emma Wilson', phone: '+14155550201', email: 'emma@example.com', tags: ['VIP', 'Regular'], customFields: { allergies: 'None known', isMedicalFlagged: false, concernArea: 'Fine lines around eyes' } });
  const james = await ensureCustomer({ name: 'James Thompson', phone: '+14155550202', tags: ['New'], customFields: { allergies: 'Latex', isMedicalFlagged: true, concernArea: 'Lip volume', contraindications: 'Blood thinners' } });
  const sofia = await ensureCustomer({ name: 'Sofia Rodriguez', phone: '+14155550203', email: 'sofia@example.com', tags: ['Regular'], customFields: { allergies: 'None', isMedicalFlagged: false } });
  const liam = await ensureCustomer({ name: 'Liam Parker', phone: '+14155550204', email: 'liam@example.com', tags: ['New'], customFields: {} });

  // 16 new customers
  const olivia = await ensureCustomer({ name: 'Olivia Martinez', phone: '+14155550210', email: 'olivia.m@example.com', tags: ['VIP', 'Regular'], customFields: { allergies: 'None', isMedicalFlagged: false, concernArea: 'Forehead lines', desiredTreatment: 'Botox', budget: '$300-$500' } });
  const noah = await ensureCustomer({ name: 'Noah Kim', phone: '+14155550211', email: 'noah.k@example.com', tags: ['Regular'], customFields: { allergies: 'None', isMedicalFlagged: false, concernArea: 'Acne scarring', desiredTreatment: 'Microneedling', budget: '$200-$400' } });
  const ava = await ensureCustomer({ name: 'Ava Chen', phone: '+14155550212', email: 'ava.c@example.com', tags: ['VIP'], customFields: { allergies: 'Lidocaine', isMedicalFlagged: true, concernArea: 'Nasolabial folds', desiredTreatment: 'Dermal Filler', budget: '$500-$800' } });
  const ethan = await ensureCustomer({ name: 'Ethan Patel', phone: '+14155550213', email: 'ethan.p@example.com', tags: ['New'], customFields: { allergies: 'None', isMedicalFlagged: false, concernArea: 'Skin texture', desiredTreatment: 'Chemical Peel' } });
  const isabella = await ensureCustomer({ name: 'Isabella Nguyen', phone: '+14155550214', email: 'isabella.n@example.com', tags: ['Regular'], customFields: { allergies: 'None', isMedicalFlagged: false, concernArea: "Crow's feet", desiredTreatment: 'Botox', budget: '$250-$400' } });
  const mason = await ensureCustomer({ name: 'Mason Brooks', phone: '+14155550215', email: 'mason.b@example.com', tags: ['New'], customFields: { allergies: 'Aspirin', isMedicalFlagged: true, concernArea: 'Under-eye hollows', desiredTreatment: 'Dermal Filler', budget: '$400-$600', contraindications: 'NSAIDs' } });
  const sophiaC = await ensureCustomer({ name: 'Sophia Lee', phone: '+14155550216', email: 'sophia.l@example.com', tags: ['VIP', 'Regular'], customFields: { allergies: 'None', isMedicalFlagged: false, concernArea: 'Full rejuvenation', desiredTreatment: 'Multiple', budget: '$1000+' } });
  const lucas = await ensureCustomer({ name: 'Lucas Wang', phone: '+14155550217', email: 'lucas.w@example.com', tags: ['Regular'], customFields: { allergies: 'None', isMedicalFlagged: false, concernArea: 'Lip enhancement', desiredTreatment: 'Dermal Filler' } });
  const mia = await ensureCustomer({ name: 'Mia Johnson', phone: '+14155550218', email: 'mia.j@example.com', tags: ['New'], customFields: { allergies: 'None', isMedicalFlagged: false, concernArea: 'Sun damage', desiredTreatment: 'Chemical Peel' } });
  const aiden = await ensureCustomer({ name: 'Aiden Wright', phone: '+14155550219', email: 'aiden.w@example.com', tags: ['Regular'], customFields: { allergies: 'None', isMedicalFlagged: false, concernArea: 'Frown lines', desiredTreatment: 'Botox' } });
  const charlotte = await ensureCustomer({ name: 'Charlotte Davis', phone: '+14155550220', email: 'charlotte.d@example.com', tags: ['VIP'], customFields: { allergies: 'None', isMedicalFlagged: false, concernArea: 'Jawline contouring', desiredTreatment: 'Dermal Filler', budget: '$600-$900' } });
  const harper = await ensureCustomer({ name: 'Harper Scott', phone: '+14155550221', email: 'harper.s@example.com', tags: ['New'], customFields: { allergies: 'None', isMedicalFlagged: false, concernArea: 'General consultation', desiredTreatment: 'Undecided' } });
  const benjamin = await ensureCustomer({ name: 'Benjamin Ali', phone: '+14155550222', email: 'benjamin.a@example.com', tags: ['Regular'], customFields: { allergies: 'None', isMedicalFlagged: false, concernArea: 'Pigmentation', desiredTreatment: 'Chemical Peel' } });
  const amelia = await ensureCustomer({ name: 'Amelia Torres', phone: '+14155550223', email: 'amelia.t@example.com', tags: ['Regular'], customFields: { allergies: 'None', isMedicalFlagged: false, concernArea: 'Skin tightening', desiredTreatment: 'Microneedling' } });
  const jack = await ensureCustomer({ name: 'Jack Robinson', phone: '+14155550224', email: 'jack.r@example.com', tags: ['New'], customFields: { allergies: 'Penicillin', isMedicalFlagged: false, concernArea: 'Acne', desiredTreatment: 'Chemical Peel' } });
  const ella = await ensureCustomer({ name: 'Ella Morgan', phone: '+14155550225', email: 'ella.m@example.com', tags: ['VIP', 'Regular'], customFields: { allergies: 'None', isMedicalFlagged: false, concernArea: 'Lip volume + forehead', desiredTreatment: 'Filler + Botox', budget: '$700-$1200' } });

  const custCount = await prisma.customer.count({ where: { businessId: bizId } });
  console.log(`✅ ${custCount} total customers (upserted)`);

  // ── 7. Create bookings ────────────────────────────────────────────────────
  async function book(
    customerId: string,
    serviceId: string,
    staffId: string,
    status: string,
    start: Date,
    durationMins: number,
    notes?: string,
  ) {
    return prisma.booking.create({
      data: {
        businessId: bizId,
        customerId,
        serviceId,
        staffId,
        status,
        startTime: start,
        endTime: addMinutes(start, durationMins),
        notes,
      },
    });
  }

  // ── 7a. Completed consults (for conversion tracking) ──────────────────────
  const consultOlivia = await book(olivia.id, svcConsult.id, sarah.id, 'COMPLETED', daysAgo(25, 9, 0), 20);
  const consultAva = await book(ava.id, svcConsult.id, sarah.id, 'COMPLETED', daysAgo(22, 11, 0), 20);
  const consultSophia = await book(sophiaC.id, svcConsult.id, emily.id, 'COMPLETED', daysAgo(20, 14, 0), 20);
  const consultHarper = await book(harper.id, svcConsult.id, sarah.id, 'COMPLETED', daysAgo(18, 10, 0), 20);
  const consultMason = await book(mason.id, svcConsult.id, emily.id, 'COMPLETED', daysAgo(15, 15, 0), 20);

  // ── 7b. Completed treatments (some following consults = conversion) ───────
  const txOlivia = await book(olivia.id, svcBotox.id, sarah.id, 'COMPLETED', daysAgo(20, 10, 0), 30, 'Post-consult treatment — forehead lines');
  const txAva = await book(ava.id, svcFiller.id, sarah.id, 'COMPLETED', daysAgo(17, 14, 0), 45, 'Post-consult — nasolabial folds, no lidocaine');
  const txSophia = await book(sophiaC.id, svcBotox.id, emily.id, 'COMPLETED', daysAgo(14, 11, 0), 30, "Post-consult — crow's feet");

  const txEmma2 = await book(emma.id, svcBotox.id, sarah.id, 'COMPLETED', daysAgo(28, 14, 0), 30, 'Regular Botox maintenance');
  const txNoah = await book(noah.id, svcMicro.id, emily.id, 'COMPLETED', daysAgo(24, 13, 0), 45, 'Session 2 of 3');
  const txIsabella = await book(isabella.id, svcBotox.id, sarah.id, 'COMPLETED', daysAgo(21, 15, 0), 30);
  const txLucas = await book(lucas.id, svcFiller.id, emily.id, 'COMPLETED', daysAgo(19, 10, 0), 45, 'Lip enhancement');
  const txBenjamin = await book(benjamin.id, svcPeel.id, sarah.id, 'COMPLETED', daysAgo(16, 11, 0), 60, 'Medium depth peel for pigmentation');
  const txAmelia = await book(amelia.id, svcMicro.id, emily.id, 'COMPLETED', daysAgo(13, 9, 0), 45);
  const txAiden = await book(aiden.id, svcBotox.id, sarah.id, 'COMPLETED', daysAgo(11, 14, 0), 30, 'Frown lines');
  const txCharlotte = await book(charlotte.id, svcFiller.id, emily.id, 'COMPLETED', daysAgo(10, 10, 30), 45, 'Jawline contouring');
  const txElla = await book(ella.id, svcBotox.id, sarah.id, 'COMPLETED', daysAgo(8, 15, 0), 30, 'Forehead lines');
  const txElla2 = await book(ella.id, svcFiller.id, emily.id, 'COMPLETED', daysAgo(8, 16, 0), 45, 'Lip volume — same day as Botox');
  const txSofia2 = await book(sofia.id, svcPeel.id, sarah.id, 'COMPLETED', daysAgo(6, 11, 0), 60);
  const txJack = await book(jack.id, svcPeel.id, emily.id, 'COMPLETED', daysAgo(5, 13, 0), 60, 'Light peel for acne');
  const txMia = await book(mia.id, svcPeel.id, sarah.id, 'COMPLETED', daysAgo(4, 10, 0), 60, 'Sun damage treatment');
  const txEthan = await book(ethan.id, svcPeel.id, emily.id, 'COMPLETED', daysAgo(3, 14, 0), 60, 'First treatment');
  const txNoah2 = await book(noah.id, svcMicro.id, emily.id, 'COMPLETED', daysAgo(2, 13, 0), 45, 'Session 3 of 3 — final');

  // ── 7c. No-shows ──────────────────────────────────────────────────────────
  await book(mason.id, svcFiller.id, sarah.id, 'NO_SHOW', daysAgo(12, 10, 0), 45);
  await book(ethan.id, svcConsult.id, sarah.id, 'NO_SHOW', daysAgo(9, 9, 0), 20);
  await book(mia.id, svcPeel.id, emily.id, 'NO_SHOW', daysAgo(7, 11, 0), 60);

  // ── 7d. Cancelled ─────────────────────────────────────────────────────────
  await book(jack.id, svcConsult.id, sarah.id, 'CANCELLED', daysAgo(23, 10, 0), 20, 'Customer rescheduled');
  await book(harper.id, svcBotox.id, emily.id, 'CANCELLED', daysAgo(14, 16, 0), 30, 'Changed mind after consult');

  // ── 7e. Confirmed (today & upcoming) ──────────────────────────────────────
  const bkToday1 = await book(isabella.id, svcBotox.id, sarah.id, 'CONFIRMED', daysFromNow(0, 14, 0), 30, 'Follow-up Botox');
  const bkToday2 = await book(noah.id, svcConsult.id, emily.id, 'CONFIRMED', daysFromNow(0, 15, 30), 20);
  const bkTomorrow = await book(charlotte.id, svcFiller.id, sarah.id, 'CONFIRMED', daysFromNow(1, 10, 0), 45, 'Touch-up');
  const bkDay2 = await book(olivia.id, svcBotox.id, sarah.id, 'CONFIRMED', daysFromNow(2, 11, 0), 30, 'Maintenance');
  await book(ella.id, svcMicro.id, emily.id, 'CONFIRMED', daysFromNow(5, 14, 0), 45, 'New treatment area');

  // ── 7f. Pending deposit ───────────────────────────────────────────────────
  await book(aiden.id, svcBotox.id, sarah.id, 'PENDING_DEPOSIT', daysFromNow(3, 10, 0), 30);
  await book(lucas.id, svcBotox.id, emily.id, 'PENDING_DEPOSIT', daysFromNow(4, 15, 0), 30);
  await book(benjamin.id, svcBotox.id, sarah.id, 'PENDING_DEPOSIT', daysFromNow(6, 11, 0), 30);

  const allCompletedTreatments = [
    txOlivia, txAva, txSophia, txEmma2, txNoah, txIsabella, txLucas,
    txBenjamin, txAmelia, txAiden, txCharlotte, txElla, txElla2,
    txSofia2, txJack, txMia, txEthan, txNoah2,
  ];

  console.log(`✅ 36 bookings created`);

  // ── 8. Payments (deposits for Botox bookings) ─────────────────────────────
  const botoxBookingsWithDeposit = [txOlivia, txIsabella, txAiden, txElla, txEmma2];
  await Promise.all(
    botoxBookingsWithDeposit.map((bk, i) =>
      prisma.payment.create({
        data: {
          bookingId: bk.id,
          stripePaymentIntentId: `pi_demo_${bk.id.slice(-8)}_${i}`,
          amount: 100,
          currency: 'usd',
          status: 'succeeded',
        },
      }),
    ),
  );
  console.log(`✅ 5 deposit payments created`);

  // ── 9. Reminders ──────────────────────────────────────────────────────────
  const reminderTemplates = await prisma.messageTemplate.findMany({ where: { businessId: bizId } });
  const tplReminder = reminderTemplates.find((t) => t.category === 'REMINDER');
  const tplAftercare = reminderTemplates.find((t) => t.category === 'AFTERCARE');
  const tplConsultFU = reminderTemplates.find((t) => t.category === 'CONSULT_FOLLOW_UP');
  const tplCheckIn = reminderTemplates.find((t) => t.category === 'TREATMENT_CHECK_IN');

  const remindersData = [
    ...allCompletedTreatments.slice(0, 8).map((bk) => ({
      businessId: bizId, bookingId: bk.id, templateId: tplAftercare?.id,
      scheduledAt: bk.startTime, sentAt: bk.startTime, status: 'SENT', type: 'AFTERCARE',
    })),
    { businessId: bizId, bookingId: consultOlivia.id, templateId: tplConsultFU?.id, scheduledAt: daysAgo(22), sentAt: daysAgo(22), status: 'SENT', type: 'CONSULT_FOLLOW_UP' },
    { businessId: bizId, bookingId: consultAva.id, templateId: tplConsultFU?.id, scheduledAt: daysAgo(19), sentAt: daysAgo(19), status: 'SENT', type: 'CONSULT_FOLLOW_UP' },
    ...allCompletedTreatments.slice(0, 5).map((bk) => ({
      businessId: bizId, bookingId: bk.id, templateId: tplCheckIn?.id,
      scheduledAt: addMinutes(bk.startTime, 24 * 60), sentAt: addMinutes(bk.startTime, 24 * 60),
      status: 'SENT', type: 'TREATMENT_CHECK_IN',
    })),
    { businessId: bizId, bookingId: bkToday1.id, templateId: tplReminder?.id, scheduledAt: daysAgo(1, 14, 0), sentAt: daysAgo(1, 14, 0), status: 'SENT', type: 'REMINDER' },
    { businessId: bizId, bookingId: bkToday2.id, templateId: tplReminder?.id, scheduledAt: daysAgo(1, 15, 30), sentAt: daysAgo(1, 15, 30), status: 'SENT', type: 'REMINDER' },
    { businessId: bizId, bookingId: bkTomorrow.id, templateId: tplReminder?.id, scheduledAt: daysFromNow(0, 10, 0), status: 'PENDING', type: 'REMINDER' },
    { businessId: bizId, bookingId: bkDay2.id, templateId: tplReminder?.id, scheduledAt: daysFromNow(1, 11, 0), status: 'PENDING', type: 'REMINDER' },
  ];

  await prisma.reminder.createMany({ data: remindersData });
  console.log(`✅ ${remindersData.length} reminders created`);

  // ── 10. Conversations & messages ──────────────────────────────────────────
  async function createConvo(
    customerId: string,
    assignedToId: string | null,
    status: string,
    lastMsgAt: Date,
    tags: string[],
    messages: Array<{ direction: string; content: string; staffId?: string; at: Date }>,
  ) {
    const convo = await prisma.conversation.create({
      data: {
        businessId: bizId,
        customerId,
        assignedToId,
        channel: 'WHATSAPP',
        status,
        lastMessageAt: lastMsgAt,
        tags,
      },
    });
    await prisma.message.createMany({
      data: messages.map((m) => ({
        conversationId: convo.id,
        direction: m.direction,
        senderStaffId: m.staffId || null,
        content: m.content,
        contentType: 'TEXT',
        createdAt: m.at,
      })),
    });
    return convo;
  }

  await createConvo(olivia.id, maria.id, 'OPEN', minutesAgo(15), ['follow-up'], [
    { direction: 'INBOUND', content: 'Hi! My Botox results have been amazing. When should I come in for my next session?', at: minutesAgo(20) },
    { direction: 'OUTBOUND', content: 'Hi Olivia! So glad to hear that! We typically recommend touch-ups every 3-4 months. Your next session would be due around mid-March.', staffId: maria.id, at: minutesAgo(15) },
    { direction: 'INBOUND', content: 'Perfect, can I book for March 15th?', at: minutesAgo(12) },
    { direction: 'OUTBOUND', content: "Let me check Dr. Chen's availability for that date. One moment!", staffId: maria.id, at: minutesAgo(7) },
  ]);

  await createConvo(noah.id, maria.id, 'OPEN', minutesAgo(45), ['post-treatment'], [
    { direction: 'OUTBOUND', content: 'Hi Noah! How is your skin feeling after your final microneedling session yesterday?', staffId: maria.id, at: minutesAgo(50) },
    { direction: 'INBOUND', content: 'A bit red still but much better than last time. When can I start using my regular skincare again?', at: minutesAgo(45) },
    { direction: 'OUTBOUND', content: 'Glad to hear the recovery is easier! You can resume your regular routine in 48 hours. Stick to gentle cleanser and SPF for now.', staffId: maria.id, at: minutesAgo(40) },
  ]);

  await createConvo(charlotte.id, sarah.id, 'SNOOZED', hoursAgo(3), ['VIP'], [
    { direction: 'INBOUND', content: 'Dr. Chen, I wanted to discuss adding cheek filler to my next jawline appointment', at: hoursAgo(4) },
    { direction: 'OUTBOUND', content: "Hi Charlotte! Absolutely, we can incorporate cheek filler into your session. I'll plan for an extended appointment.", staffId: sarah.id, at: hoursAgo(3) },
    { direction: 'INBOUND', content: 'Yes! How much extra will that be?', at: hoursAgo(2.5) },
  ]);

  await createConvo(mason.id, null, 'OPEN', hoursAgo(6), ['no-show', 'needs-attention'], [
    { direction: 'OUTBOUND', content: 'Hi Mason, we noticed you missed your appointment yesterday. Would you like to reschedule?', staffId: maria.id, at: hoursAgo(8) },
    { direction: 'INBOUND', content: 'Sorry about that, I had an emergency. Can I rebook for sometime next week?', at: hoursAgo(6) },
  ]);

  await createConvo(ava.id, sarah.id, 'OPEN', hoursAgo(1), ['medical', 'urgent'], [
    { direction: 'INBOUND', content: 'Hi, I have a question about my filler treatment. I noticed some slight swelling on one side. Is this normal?', at: hoursAgo(2) },
    { direction: 'OUTBOUND', content: 'Hi Ava, mild asymmetric swelling can be normal in the first few days. Can you send a photo so I can take a closer look?', staffId: sarah.id, at: hoursAgo(1.5) },
    { direction: 'INBOUND', content: 'Sure, sending one now', at: hoursAgo(1) },
  ]);

  await createConvo(ella.id, maria.id, 'OPEN', hoursAgo(5), ['VIP', 'rebooking'], [
    { direction: 'INBOUND', content: 'Hey! I loved both treatments last time. Can we schedule another combo session — Botox and lip filler?', at: hoursAgo(6) },
    { direction: 'OUTBOUND', content: 'Hi Ella! Of course! We have availability next Thursday. Botox at 2 PM followed by lip filler at 2:45 PM. Would that work?', staffId: maria.id, at: hoursAgo(5.5) },
    { direction: 'INBOUND', content: 'Thursday works! Please book it.', at: hoursAgo(5) },
  ]);

  await createConvo(harper.id, null, 'CLOSED', daysAgo(10), [], [
    { direction: 'INBOUND', content: "Thanks for the consultation. I'm going to think about it a bit more before deciding.", at: daysAgo(16) },
    { direction: 'OUTBOUND', content: "Of course, Harper! Take your time. Feel free to reach out whenever you're ready.", staffId: sarah.id, at: daysAgo(16, 12, 0) },
  ]);

  await createConvo(amelia.id, emily.id, 'OPEN', daysAgo(1, 16, 0), ['feedback'], [
    { direction: 'INBOUND', content: 'Hi! Just wanted to say my microneedling results are incredible. My skin has never looked better!', at: daysAgo(1, 15, 0) },
    { direction: 'OUTBOUND', content: "That's wonderful to hear, Amelia! Dr. Park will be thrilled. Would you be open to sharing a before/after photo?", staffId: emily.id, at: daysAgo(1, 16, 0) },
  ]);

  console.log('✅ 8 conversations with messages created');

  // ── 11. Waitlist entries ──────────────────────────────────────────────────
  await prisma.waitlistEntry.createMany({
    data: [
      { businessId: bizId, customerId: mason.id, serviceId: svcFiller.id, staffId: sarah.id, status: 'ACTIVE', timeWindowStart: '09:00', timeWindowEnd: '12:00', notes: 'Wants morning slot' },
      { businessId: bizId, customerId: jack.id, serviceId: svcPeel.id, status: 'ACTIVE', notes: 'Any time works' },
      { businessId: bizId, customerId: harper.id, serviceId: svcBotox.id, staffId: sarah.id, status: 'ACTIVE', timeWindowStart: '14:00', timeWindowEnd: '17:00', notes: 'Afternoon preferred' },
      { businessId: bizId, customerId: mia.id, serviceId: svcPeel.id, staffId: emily.id, status: 'ACTIVE', dateFrom: daysFromNow(1), dateTo: daysFromNow(14), notes: 'Next 2 weeks' },
      {
        businessId: bizId, customerId: ethan.id, serviceId: svcMicro.id, status: 'OFFERED',
        offeredAt: hoursAgo(2), offerExpiresAt: daysFromNow(1),
        offeredSlot: { date: daysFromNow(3).toISOString().split('T')[0], time: '10:00', staffId: emily.id },
      },
      {
        businessId: bizId, customerId: isabella.id, serviceId: svcBotox.id, staffId: sarah.id, status: 'BOOKED',
        offeredAt: daysAgo(2), claimedAt: daysAgo(1), bookingId: bkToday1.id,
      },
    ],
  });
  console.log('✅ 6 waitlist entries created');

  // ── 12. Campaigns ─────────────────────────────────────────────────────────
  const campaign1 = await prisma.campaign.create({
    data: {
      businessId: bizId, name: 'February Glow-Up Special', status: 'SENT',
      filters: { tags: ['Regular', 'VIP'], services: [] },
      sentAt: daysAgo(5),
      stats: { total: 12, sent: 12, delivered: 11, read: 8, failed: 1, booked: 3 },
    },
  });

  const sendCustomers = [olivia, noah, ava, isabella, sophiaC, lucas, aiden, charlotte, benjamin, amelia, ella, emma];
  const sendStatuses = ['DELIVERED', 'READ', 'READ', 'READ', 'DELIVERED', 'READ', 'DELIVERED', 'READ', 'DELIVERED', 'READ', 'READ', 'FAILED'];
  await prisma.campaignSend.createMany({
    data: sendCustomers.map((c, i) => ({
      campaignId: campaign1.id, customerId: c.id, status: sendStatuses[i], sentAt: daysAgo(5),
    })),
  });

  await prisma.campaign.create({
    data: {
      businessId: bizId, name: 'Spring Skincare Launch', status: 'DRAFT',
      filters: { tags: ['New'], services: [svcPeel.id, svcMicro.id] }, stats: {},
    },
  });

  await prisma.campaign.create({
    data: {
      businessId: bizId, name: 'March Loyalty Rewards', status: 'SCHEDULED',
      filters: { tags: ['VIP'] }, scheduledAt: daysFromNow(12), stats: {},
    },
  });

  console.log('✅ 3 campaigns created (1 SENT with 12 sends, 1 DRAFT, 1 SCHEDULED)');

  // ── 13. Automation rules + logs ───────────────────────────────────────────
  const rule1 = await prisma.automationRule.create({
    data: {
      businessId: bizId, name: '24h Appointment Reminder', trigger: 'BOOKING_UPCOMING',
      filters: { hoursBeforeStart: 24 },
      actions: [{ type: 'SEND_MESSAGE', templateCategory: 'REMINDER' }],
      isActive: true, playbook: 'reminder_24h', quietStart: '21:00', quietEnd: '08:00',
    },
  });

  const rule2 = await prisma.automationRule.create({
    data: {
      businessId: bizId, name: 'Post-Treatment Aftercare', trigger: 'STATUS_CHANGED',
      filters: { toStatus: 'COMPLETED', serviceKind: 'TREATMENT' },
      actions: [{ type: 'SEND_MESSAGE', templateCategory: 'AFTERCARE' }],
      isActive: true, playbook: 'aftercare',
    },
  });

  const rule3 = await prisma.automationRule.create({
    data: {
      businessId: bizId, name: 'No-Show Follow-up', trigger: 'STATUS_CHANGED',
      filters: { toStatus: 'NO_SHOW' },
      actions: [
        { type: 'SEND_MESSAGE', body: 'Hi {{customerName}}, we missed you today! Would you like to reschedule?' },
        { type: 'ADD_TAG', tag: 'no-show' },
      ],
      isActive: true,
    },
  });

  const automationLogsData = [
    ...allCompletedTreatments.slice(0, 6).map((bk) => ({
      automationRuleId: rule1.id, businessId: bizId, bookingId: bk.id, customerId: bk.customerId,
      action: 'SEND_MESSAGE', outcome: 'SENT' as const, createdAt: addMinutes(bk.startTime, -24 * 60),
    })),
    {
      automationRuleId: rule1.id, businessId: bizId, bookingId: txCharlotte.id, customerId: charlotte.id,
      action: 'SEND_MESSAGE', outcome: 'SKIPPED' as const, reason: 'Quiet hours (21:00-08:00)',
      createdAt: daysAgo(11, 22, 0),
    },
    ...allCompletedTreatments.slice(0, 5).map((bk) => ({
      automationRuleId: rule2.id, businessId: bizId, bookingId: bk.id, customerId: bk.customerId,
      action: 'SEND_MESSAGE', outcome: 'SENT' as const, createdAt: bk.startTime,
    })),
    { automationRuleId: rule3.id, businessId: bizId, customerId: mason.id, action: 'SEND_MESSAGE', outcome: 'SENT' as const, createdAt: daysAgo(12, 11, 0) },
    { automationRuleId: rule3.id, businessId: bizId, customerId: mason.id, action: 'ADD_TAG', outcome: 'SENT' as const, createdAt: daysAgo(12, 11, 0) },
    { automationRuleId: rule3.id, businessId: bizId, customerId: ethan.id, action: 'SEND_MESSAGE', outcome: 'SENT' as const, createdAt: daysAgo(9, 10, 0) },
    { automationRuleId: rule3.id, businessId: bizId, customerId: mia.id, action: 'SEND_MESSAGE', outcome: 'FAILED' as const, reason: 'WhatsApp delivery failed', createdAt: daysAgo(7, 12, 0) },
  ];

  await prisma.automationLog.createMany({ data: automationLogsData });
  console.log(`✅ 3 automation rules + ${automationLogsData.length} logs created`);

  // ── 14. Offers ────────────────────────────────────────────────────────────
  await prisma.offer.createMany({
    data: [
      {
        businessId: bizId, name: 'New Patient Special',
        description: '20% off your first treatment when you book a consultation',
        terms: 'Valid for new patients only. Cannot be combined with other offers.',
        serviceIds: [svcConsult.id, svcBotox.id, svcFiller.id, svcPeel.id, svcMicro.id],
        validFrom: daysAgo(30), validUntil: daysFromNow(60), isActive: true,
      },
      {
        businessId: bizId, name: 'Loyalty Reward — 3rd Visit Free Peel',
        description: 'Complimentary chemical peel on your 3rd visit',
        terms: 'Available to patients with 2+ completed treatments. One per customer.',
        serviceIds: [svcPeel.id],
        validFrom: daysAgo(14), validUntil: daysFromNow(90), isActive: true,
      },
    ],
  });
  console.log('✅ 2 offers created');

  // ── 15. ROI Baseline (ensure one exists) ──────────────────────────────────
  const existingBaseline = await prisma.roiBaseline.findFirst({ where: { businessId: bizId } });
  if (!existingBaseline) {
    const baselineEnd = daysAgo(7);
    const baselineStart = daysAgo(14);
    await prisma.roiBaseline.create({
      data: {
        businessId: bizId,
        goLiveDate: baselineEnd,
        baselineStart,
        baselineEnd,
        metrics: {
          noShowRate: 18, noShowTotal: 50, noShowCount: 9,
          consultConversionRate: 45, consultCustomers: 11, consultConverted: 5,
          avgResponseMinutes: 12, responseSampleSize: 40,
          totalRevenue: 4200, completedBookings: 32, avgBookingValue: 131.25,
          statusBreakdown: [
            { status: 'COMPLETED', count: 32 }, { status: 'NO_SHOW', count: 9 },
            { status: 'CANCELLED', count: 5 }, { status: 'PENDING', count: 4 },
          ],
        },
      },
    });
    console.log('✅ ROI baseline created');
  }

  // ── 16. Mark demo as seeded ───────────────────────────────────────────────
  const latestConfig = (await prisma.business.findUnique({ where: { id: bizId } }))!.packConfig as Record<string, unknown>;
  await prisma.business.update({
    where: { id: bizId },
    data: {
      packConfig: { ...latestConfig, demoSeeded: true },
    },
  });

  console.log('\n🎉 Demo data seeded successfully!');
  console.log('  - 20 customers');
  console.log('  - 36 bookings');
  console.log('  - 8 conversations with ~30 messages');
  console.log('  - 6 waitlist entries');
  console.log('  - 3 campaigns (1 with 12 sends)');
  console.log('  - 3 automation rules + 16 logs');
  console.log('  - 2 offers');
  console.log('  - 5 deposit payments');
  console.log('  - 19 reminders');
}

main()
  .catch((e) => {
    console.error('❌ Demo seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

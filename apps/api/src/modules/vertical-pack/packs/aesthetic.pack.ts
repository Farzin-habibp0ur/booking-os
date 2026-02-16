import { VerticalPackDefinition, TemplateCategory } from '@booking-os/shared';

export const aestheticPack: VerticalPackDefinition = {
  name: 'aesthetic',
  labels: {
    customer: 'Patient',
    booking: 'Appointment',
    service: 'Treatment',
  },
  customerFields: [
    { key: 'isMedicalFlagged', type: 'boolean', label: 'Medical Flag' },
    { key: 'allergies', type: 'text', label: 'Known Allergies' },
    { key: 'concernArea', type: 'text', label: 'Concern Area' },
    { key: 'desiredTreatment', type: 'text', label: 'Desired Treatment' },
    { key: 'budget', type: 'select', label: 'Budget Range', options: ['Under $250', '$250-$500', '$500-$1000', 'Over $1000'] },
    { key: 'preferredProvider', type: 'text', label: 'Preferred Provider' },
    { key: 'contraindications', type: 'text', label: 'Contraindications' },
  ],
  bookingFields: [
    { key: 'isConsultation', type: 'boolean', label: 'Consultation Visit' },
    { key: 'treatmentArea', type: 'text', label: 'Treatment Area' },
  ],
  serviceFields: [
    { key: 'requiresConsultation', type: 'boolean', label: 'Requires Prior Consultation' },
  ],
  defaultTemplates: [
    {
      name: '24h Reminder',
      category: TemplateCategory.REMINDER,
      body: 'Hi {{customerName}}! Reminder: your {{serviceName}} is tomorrow at {{time}} with {{staffName}} at Glow Aesthetic Clinic. Reply YES to confirm.',
      variables: ['customerName', 'serviceName', 'time', 'staffName'],
    },
    {
      name: 'Booking Confirmation',
      category: TemplateCategory.CONFIRMATION,
      body: 'Your {{serviceName}} has been booked for {{date}} at {{time}}. See you at Glow Aesthetic Clinic! ✨',
      variables: ['serviceName', 'date', 'time'],
    },
    {
      name: 'Follow-up',
      category: TemplateCategory.FOLLOW_UP,
      body: 'Hi {{customerName}}, how are you feeling after your {{serviceName}}? Let us know if you have any questions! 💫',
      variables: ['customerName', 'serviceName'],
    },
    {
      name: 'Consult Follow-up',
      category: TemplateCategory.CONSULT_FOLLOW_UP,
      body: 'Hi {{customerName}}, we hope your consultation at {{businessName}} was helpful! Ready to move forward with treatment? Book here: {{bookingLink}}',
      variables: ['customerName', 'businessName', 'bookingLink'],
    },
    {
      name: 'Aftercare Instructions',
      category: TemplateCategory.AFTERCARE,
      body: 'Hi {{customerName}}, thank you for your {{serviceName}} at {{businessName}}! Here are your aftercare reminders: avoid direct sun exposure, keep the area clean, and contact us if you have any concerns.',
      variables: ['customerName', 'serviceName', 'businessName'],
    },
    {
      name: 'Treatment Check-in',
      category: TemplateCategory.TREATMENT_CHECK_IN,
      body: "Hi {{customerName}}, it's been 24 hours since your {{serviceName}} at {{businessName}}. How are you feeling? Let us know if you have any questions or concerns.",
      variables: ['customerName', 'serviceName', 'businessName'],
    },
    {
      name: 'Deposit Request',
      category: TemplateCategory.DEPOSIT_REQUIRED,
      body: 'Hi {{customerName}}, your {{serviceName}} at {{businessName}} on {{date}} at {{time}} requires a deposit of ${{depositAmount}} to confirm your booking. Please complete your payment to secure your appointment.',
      variables: ['customerName', 'serviceName', 'businessName', 'date', 'time', 'depositAmount'],
    },
    {
      name: 'Cancellation Confirmation',
      category: TemplateCategory.CANCELLATION,
      body: 'Hi {{customerName}}, your {{serviceName}} on {{date}} at {{time}} at {{businessName}} has been cancelled. If this was a mistake, please contact us to rebook.',
      variables: ['customerName', 'serviceName', 'date', 'time', 'businessName'],
    },
    {
      name: 'Reschedule Link',
      category: TemplateCategory.RESCHEDULE_LINK,
      body: 'Hi {{customerName}}, need to reschedule your {{serviceName}} on {{date}} at {{time}}? Use this link: {{rescheduleLink}}',
      variables: ['customerName', 'serviceName', 'date', 'time', 'rescheduleLink'],
    },
    {
      name: 'Cancel Link',
      category: TemplateCategory.CANCEL_LINK,
      body: 'Hi {{customerName}}, need to cancel your {{serviceName}} on {{date}} at {{time}}? Use this link: {{cancelLink}}',
      variables: ['customerName', 'serviceName', 'date', 'time', 'cancelLink'],
    },
  ],
  defaultServices: [
    { name: 'Consultation', durationMins: 30, price: 0, category: 'Consultation', kind: 'CONSULT' },
    { name: 'Botox', durationMins: 30, price: 350, category: 'Injectable', kind: 'TREATMENT', depositRequired: true, depositAmount: 50 },
    { name: 'Dermal Filler', durationMins: 45, price: 550, category: 'Injectable', kind: 'TREATMENT' },
    { name: 'Chemical Peel', durationMins: 45, price: 200, category: 'Skin', kind: 'TREATMENT' },
    { name: 'Microneedling', durationMins: 60, price: 300, category: 'Skin', kind: 'TREATMENT' },
  ],
  defaultNotificationSettings: {
    channels: 'both',
    followUpDelayHours: 2,
    consultFollowUpDays: 3,
    treatmentCheckInHours: 24,
  },
  defaultRequiredProfileFields: ['firstName', 'email'],
  defaultPackConfig: { requireConsultation: true, medicalFormRequired: true },
};

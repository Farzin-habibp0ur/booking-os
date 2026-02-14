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
    {
      key: 'skinType',
      type: 'select',
      label: 'Skin Type',
      options: ['I', 'II', 'III', 'IV', 'V', 'VI'],
    },
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
  ],
};

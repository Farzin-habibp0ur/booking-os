import { VerticalPackDefinition, TemplateCategory } from '@booking-os/shared';

export const generalPack: VerticalPackDefinition = {
  name: 'general',
  labels: {
    customer: 'Customer',
    booking: 'Booking',
    service: 'Service',
  },
  customerFields: [],
  bookingFields: [{ key: 'notes', type: 'text', label: 'Notes' }],
  serviceFields: [],
  defaultTemplates: [
    {
      name: '24h Reminder',
      category: TemplateCategory.REMINDER,
      body: 'Hi {{customerName}}! Reminder: your {{serviceName}} is tomorrow at {{time}}. Reply YES to confirm.',
      variables: ['customerName', 'serviceName', 'time'],
    },
    {
      name: 'Booking Confirmation',
      category: TemplateCategory.CONFIRMATION,
      body: 'Your {{serviceName}} has been booked for {{date}} at {{time}}. See you soon!',
      variables: ['serviceName', 'date', 'time'],
    },
  ],
  defaultServices: [
    { name: 'General Appointment', durationMins: 30, price: 0, category: 'General', kind: 'OTHER' },
  ],
  defaultNotificationSettings: {
    channels: 'both',
    followUpDelayHours: 2,
    consultFollowUpDays: 3,
    treatmentCheckInHours: 24,
  },
  defaultRequiredProfileFields: ['firstName'],
  defaultPackConfig: {},
};

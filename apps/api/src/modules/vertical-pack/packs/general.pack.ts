import { VerticalPackDefinition, TemplateCategory } from '@booking-os/shared';

export const generalPack: VerticalPackDefinition = {
  name: 'general',
  labels: {
    customer: 'Customer',
    booking: 'Booking',
    service: 'Service',
  },
  customerFields: [],
  bookingFields: [
    { key: 'notes', type: 'text', label: 'Notes' },
  ],
  serviceFields: [],
  defaultTemplates: [
    {
      name: '24h Reminder',
      category: TemplateCategory.REMINDER,
      body: 'Hi {{customerName}}! Reminder: your {{serviceName}} is tomorrow at {{time}}. Reply YES to confirm.',
      variables: ['customerName', 'serviceName', 'time'],
    },
  ],
};

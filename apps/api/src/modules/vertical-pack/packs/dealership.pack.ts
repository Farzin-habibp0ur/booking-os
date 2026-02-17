import { VerticalPackDefinition, TemplateCategory } from '@booking-os/shared';

export const dealershipPack: VerticalPackDefinition = {
  name: 'dealership',
  labels: {
    customer: 'Client',
    booking: 'Appointment',
    service: 'Service',
  },
  customerFields: [
    { key: 'make', type: 'text', label: 'Make', required: true },
    { key: 'model', type: 'text', label: 'Model', required: true },
    { key: 'year', type: 'number', label: 'Year' },
    { key: 'vin', type: 'text', label: 'VIN' },
    { key: 'mileage', type: 'number', label: 'Mileage' },
    {
      key: 'interestType',
      type: 'select',
      label: 'Interest Type',
      options: ['New', 'Used', 'Trade-in', 'Service'],
    },
  ],
  bookingFields: [
    { key: 'vehicleNotes', type: 'text', label: 'Vehicle Notes' },
  ],
  serviceFields: [],
  defaultTemplates: [
    {
      name: 'Car Ready for Pickup',
      category: TemplateCategory.CUSTOM,
      body: 'Hi {{customerName}}, your vehicle is ready for pickup at {{businessName}}! Please bring your service receipt. We look forward to seeing you.',
      variables: ['customerName', 'businessName'],
    },
    {
      name: 'Service Status Update',
      category: TemplateCategory.CUSTOM,
      body: 'Hi {{customerName}}, here is an update on your vehicle at {{businessName}}: {{statusMessage}}. If you have questions, reply to this message.',
      variables: ['customerName', 'businessName', 'statusMessage'],
    },
    {
      name: 'Quote Approval Request',
      category: TemplateCategory.CUSTOM,
      body: 'Hi {{customerName}}, we have prepared a service quote for your vehicle at {{businessName}}. Total: ${{totalAmount}}. Please review and approve here: {{approvalLink}}',
      variables: ['customerName', 'businessName', 'totalAmount', 'approvalLink'],
    },
    {
      name: '6-Month Maintenance Nudge',
      category: TemplateCategory.FOLLOW_UP,
      body: "Hi {{customerName}}, it's been 6 months since your last service at {{businessName}}. Time for a maintenance check? Book your appointment: {{bookingLink}}",
      variables: ['customerName', 'businessName', 'bookingLink'],
    },
    {
      name: 'Test Drive Confirmation',
      category: TemplateCategory.CONFIRMATION,
      body: 'Your test drive has been booked for {{date}} at {{time}} at {{businessName}}. Please bring a valid driver\'s license. See you soon!',
      variables: ['date', 'time', 'businessName'],
    },
    {
      name: 'Booking Confirmation',
      category: TemplateCategory.CONFIRMATION,
      body: 'Your {{serviceName}} appointment has been booked for {{date}} at {{time}} at {{businessName}}. See you then!',
      variables: ['serviceName', 'date', 'time', 'businessName'],
    },
    {
      name: '24h Reminder',
      category: TemplateCategory.REMINDER,
      body: 'Hi {{customerName}}! Reminder: your {{serviceName}} is tomorrow at {{time}} at {{businessName}}. Reply YES to confirm.',
      variables: ['customerName', 'serviceName', 'time', 'businessName'],
    },
    {
      name: 'Cancellation Confirmation',
      category: TemplateCategory.CANCELLATION,
      body: 'Hi {{customerName}}, your {{serviceName}} on {{date}} at {{time}} at {{businessName}} has been cancelled. Contact us to rebook.',
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
    { name: 'Test Drive', durationMins: 30, price: 0, category: 'Sales', kind: 'CONSULT' },
    { name: 'Routine Maintenance', durationMins: 60, price: 150, category: 'Service', kind: 'TREATMENT' },
    { name: 'Brake Service', durationMins: 90, price: 250, category: 'Service', kind: 'TREATMENT' },
    { name: 'Oil Change', durationMins: 30, price: 60, category: 'Service', kind: 'TREATMENT' },
    { name: 'Diagnostic Check', durationMins: 45, price: 80, category: 'Service', kind: 'CONSULT' },
  ],
  defaultNotificationSettings: {
    channels: 'both',
    followUpDelayHours: 2,
    consultFollowUpDays: 3,
    treatmentCheckInHours: 24,
  },
  defaultRequiredProfileFields: ['firstName', 'phone'],
  defaultPackConfig: {
    kanbanEnabled: true,
    kanbanStatuses: ['CHECKED_IN', 'DIAGNOSING', 'AWAITING_APPROVAL', 'IN_PROGRESS', 'READY_FOR_PICKUP'],
  },
};

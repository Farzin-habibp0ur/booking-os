import { VerticalPackDefinition, TemplateCategory } from '@booking-os/shared';

export const wellnessPack: VerticalPackDefinition = {
  name: 'wellness',
  labels: {
    customer: 'Client',
    booking: 'Session',
    service: 'Service',
  },
  customerFields: [
    { key: 'healthGoals', type: 'text', label: 'Health & Wellness Goals', required: true },
    {
      key: 'fitnessLevel',
      type: 'select',
      label: 'Fitness Level',
      options: ['Beginner', 'Intermediate', 'Advanced', 'Elite'],
    },
    { key: 'injuries', type: 'text', label: 'Current Injuries / Conditions' },
    { key: 'medications', type: 'text', label: 'Current Medications' },
    { key: 'allergies', type: 'text', label: 'Allergies (oils, scents, latex)' },
    {
      key: 'preferredModality',
      type: 'select',
      label: 'Preferred Modality',
      options: ['Massage', 'Yoga', 'Personal Training', 'Nutrition', 'Meditation', 'No Preference'],
    },
    { key: 'membershipType', type: 'select', label: 'Membership', options: ['Drop-in', 'Monthly', 'Annual', 'VIP'] },
  ],
  bookingFields: [
    { key: 'sessionNotes', type: 'text', label: 'Session Notes' },
    { key: 'pressureLevel', type: 'select', label: 'Pressure Level', options: ['Light', 'Medium', 'Deep', 'Varies'] },
  ],
  serviceFields: [],
  defaultTemplates: [
    {
      name: '24h Reminder',
      category: TemplateCategory.REMINDER,
      body: 'Hi {{customerName}}! Reminder: your {{serviceName}} session is tomorrow at {{time}} with {{staffName}}. Please arrive 10 min early. Reply YES to confirm.',
      variables: ['customerName', 'serviceName', 'time', 'staffName'],
    },
    {
      name: 'Session Confirmation',
      category: TemplateCategory.CONFIRMATION,
      body: 'Your {{serviceName}} session has been booked for {{date}} at {{time}}. Wear comfortable clothing and stay hydrated! 🧘',
      variables: ['serviceName', 'date', 'time'],
    },
    {
      name: 'Post-Session Follow-up',
      category: TemplateCategory.FOLLOW_UP,
      body: 'Hi {{customerName}}, how are you feeling after your {{serviceName}} session? Remember to stay hydrated and rest. Let us know if you have any questions!',
      variables: ['customerName', 'serviceName'],
    },
    {
      name: 'Progress Check-in',
      category: TemplateCategory.TREATMENT_CHECK_IN,
      body: "Hi {{customerName}}, it's been a month since you started your wellness journey with us! How are you progressing toward your goals? Book your next session: {{bookingLink}}",
      variables: ['customerName', 'bookingLink'],
    },
    {
      name: 'Wellness Tip',
      category: TemplateCategory.CUSTOM,
      body: "Hi {{customerName}}, here's your weekly wellness tip to complement your {{serviceName}} sessions: stay consistent with your practice and listen to your body. See you soon!",
      variables: ['customerName', 'serviceName'],
    },
    {
      name: 'Membership Renewal',
      category: TemplateCategory.CUSTOM,
      body: 'Hi {{customerName}}, your membership at {{businessName}} is coming up for renewal. Renew now to keep your wellness journey going! Contact us for details.',
      variables: ['customerName', 'businessName'],
    },
    {
      name: 'Cancellation Confirmation',
      category: TemplateCategory.CANCELLATION,
      body: 'Hi {{customerName}}, your {{serviceName}} on {{date}} at {{time}} at {{businessName}} has been cancelled. Contact us to rebook when you are ready.',
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
    { name: 'Initial Wellness Consultation', durationMins: 30, price: 0, category: 'Consultation', kind: 'CONSULT' },
    { name: 'Swedish Massage', durationMins: 60, price: 90, category: 'Massage', kind: 'TREATMENT' },
    { name: 'Deep Tissue Massage', durationMins: 60, price: 110, category: 'Massage', kind: 'TREATMENT' },
    { name: 'Yoga Private Session', durationMins: 60, price: 75, category: 'Yoga', kind: 'TREATMENT' },
    { name: 'Personal Training', durationMins: 60, price: 80, category: 'Training', kind: 'TREATMENT' },
    { name: 'Nutrition Coaching', durationMins: 45, price: 65, category: 'Coaching', kind: 'CONSULT' },
  ],
  defaultNotificationSettings: {
    channels: 'both',
    followUpDelayHours: 2,
    consultFollowUpDays: 3,
    treatmentCheckInHours: 24,
  },
  defaultRequiredProfileFields: ['firstName', 'email'],
  defaultPackConfig: {
    trackProgress: true,
    membershipEnabled: true,
    intakeFormRequired: true,
  },
};

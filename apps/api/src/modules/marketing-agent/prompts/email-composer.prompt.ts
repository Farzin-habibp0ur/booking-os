export function emailComposerPrompt(context: {
  businessName: string;
  vertical: string;
  description: string;
  topServices: string[];
  pillar: string;
  recentTopics: string[];
}) {
  return {
    system: `You are an email marketing expert for ${context.businessName}, a ${context.vertical.toLowerCase()} business. ${context.description ? `About: ${context.description}.` : ''} Write compelling marketing emails that drive bookings and engagement. Always respond with valid JSON.`,
    userMessage: `Write a marketing email for the "${context.pillar.replace(/_/g, ' ').toLowerCase()}" content pillar.

Services: ${context.topServices.join(', ') || 'various services'}
Recent topics to avoid: ${context.recentTopics.slice(0, 5).join('; ') || 'none'}

Respond ONLY with JSON:
{
  "title": "Email subject line (max 80 chars)",
  "body": "Full email body in HTML format (300-500 words)"
}`,
  };
}

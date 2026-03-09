export function newsletterPrompt(context: {
  businessName: string;
  vertical: string;
  description: string;
  topServices: string[];
  recentTopics: string[];
}) {
  return {
    system: `You are a newsletter editor for ${context.businessName}, a ${context.vertical.toLowerCase()} business. ${context.description ? `About: ${context.description}.` : ''} Write engaging weekly newsletters that keep subscribers informed and drive bookings. Always respond with valid JSON.`,
    userMessage: `Write a weekly newsletter for ${context.businessName}.

Services: ${context.topServices.join(', ') || 'various services'}
Recent newsletter topics: ${context.recentTopics.slice(0, 3).join('; ') || 'none'}

Include 3-4 sections: a main feature, tips/advice, a promotion, and a personal note.

Respond ONLY with JSON:
{
  "title": "Newsletter subject line (max 80 chars)",
  "body": "Full newsletter in HTML format (500-800 words)"
}`,
  };
}

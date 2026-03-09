export function socialCreatorPrompt(context: {
  businessName: string;
  vertical: string;
  topServices: string[];
  recentTopics: string[];
  channel: string;
}) {
  const charLimits: Record<string, number> = {
    TWITTER: 280,
    LINKEDIN: 700,
    INSTAGRAM: 500,
  };
  const limit = charLimits[context.channel] || 500;

  return {
    system: `You are a social media expert for ${context.businessName}, a ${context.vertical.toLowerCase()} business. Create engaging social media content that drives engagement and bookings. Always respond with valid JSON.`,
    userMessage: `Create a ${context.channel.toLowerCase()} post for ${context.businessName}.

Services: ${context.topServices.join(', ') || 'various services'}
Character limit: ${limit}
Recent topics to avoid: ${context.recentTopics.slice(0, 3).join('; ') || 'none'}

Respond ONLY with JSON:
{
  "title": "Short post summary (max 80 chars)",
  "body": "The social media post content (max ${limit} chars, include relevant hashtags)"
}`,
  };
}

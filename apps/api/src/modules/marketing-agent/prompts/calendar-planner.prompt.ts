export function calendarPlannerPrompt(context: {
  businessName: string;
  vertical: string;
  gaps: { missingChannels: string[]; missingPillars: string[] };
  recentTopics: string[];
}) {
  return {
    system: `You are a content calendar strategist for ${context.businessName}, a ${context.vertical.toLowerCase()} business. Plan content calendars that maintain consistent output across all channels and pillars. Always respond with valid JSON.`,
    userMessage: `Plan content to fill gaps for ${context.businessName} over the next 7 days.

Missing channels (no scheduled content): ${context.gaps.missingChannels.join(', ') || 'none'}
Missing pillars (no scheduled content): ${context.gaps.missingPillars.join(', ') || 'none'}
Recent topics: ${context.recentTopics.slice(0, 5).join('; ') || 'none'}

Respond ONLY with JSON:
{
  "summary": "Brief calendar plan overview (1-2 paragraphs)",
  "recommendations": ["topic 1 for channel X", "topic 2 for pillar Y", "topic 3 for channel Z"]
}`,
  };
}

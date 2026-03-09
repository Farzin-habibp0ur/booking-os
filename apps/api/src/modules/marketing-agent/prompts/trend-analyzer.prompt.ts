export function trendAnalyzerPrompt(context: {
  businessName: string;
  vertical: string;
  contentStats: { byContentType: Record<string, number>; byStatus: Record<string, number> };
  recentTopics: string[];
}) {
  return {
    system: `You are a content analytics expert for ${context.businessName}, a ${context.vertical.toLowerCase()} business. Analyze content performance data and provide actionable insights. Always respond with valid JSON.`,
    userMessage: `Analyze the content trends for ${context.businessName}.

Content stats: ${JSON.stringify(context.contentStats)}
Recent topics: ${context.recentTopics.join('; ') || 'none'}

Respond ONLY with JSON:
{
  "summary": "Brief trend analysis (2-3 paragraphs)",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}`,
  };
}

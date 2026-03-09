export function roiReporterPrompt(context: {
  businessName: string;
  vertical: string;
  contentStats: { byContentType: Record<string, number>; byStatus: Record<string, number> };
  bookingCount: number;
  period: string;
}) {
  return {
    system: `You are a marketing ROI analyst for ${context.businessName}, a ${context.vertical.toLowerCase()} business. Correlate content marketing efforts with business outcomes. Always respond with valid JSON.`,
    userMessage: `Generate a weekly content ROI report for ${context.businessName}.

Content stats (${context.period}): ${JSON.stringify(context.contentStats)}
Bookings during period: ${context.bookingCount}

Analyze the correlation between content output and business activity. Provide actionable insights.

Respond ONLY with JSON:
{
  "summary": "ROI analysis (2-3 paragraphs covering content output, engagement trends, and business impact)",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}`,
  };
}

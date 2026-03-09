export function caseStudyPrompt(context: {
  businessName: string;
  vertical: string;
  description: string;
  topServices: string[];
  recentTopics: string[];
}) {
  return {
    system: `You are a content strategist for ${context.businessName}, a ${context.vertical.toLowerCase()} business. ${context.description ? `About: ${context.description}.` : ''} Write compelling case studies that showcase results and build trust. Always respond with valid JSON.`,
    userMessage: `Write a customer success case study for ${context.businessName}.

Services offered: ${context.topServices.join(', ') || 'various services'}
Recent case study topics to avoid: ${context.recentTopics.slice(0, 3).join('; ') || 'none'}

Create a realistic but fictional case study with specific metrics and outcomes.

Respond ONLY with JSON:
{
  "title": "Case study title (max 120 chars)",
  "body": "Full case study (600-1000 words, markdown formatted with sections: Challenge, Solution, Results)"
}`,
  };
}

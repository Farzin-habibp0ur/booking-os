export function videoScriptPrompt(context: {
  businessName: string;
  vertical: string;
  topServices: string[];
  recentTopics: string[];
}) {
  return {
    system: `You are a video content creator for ${context.businessName}, a ${context.vertical.toLowerCase()} business. Write engaging YouTube video scripts that educate and attract potential customers. Always respond with valid JSON.`,
    userMessage: `Write a YouTube video script for ${context.businessName}.

Services: ${context.topServices.join(', ') || 'various services'}
Recent video topics to avoid: ${context.recentTopics.slice(0, 3).join('; ') || 'none'}

Respond ONLY with JSON:
{
  "title": "Video title (max 100 chars, YouTube optimized)",
  "body": "Full script (3-5 minutes reading time, include [INTRO], [MAIN], [CTA] sections)"
}`,
  };
}

export function blogWriterPrompt(context: {
  businessName: string;
  vertical: string;
  description: string;
  topServices: string[];
  pillar: string;
  recentTopics: string[];
}) {
  return {
    system: `You are a professional blog writer for ${context.businessName}, a ${context.vertical.toLowerCase()} business. ${context.description ? `Business description: ${context.description}.` : ''} Write engaging, SEO-friendly blog posts that attract potential customers. Always respond with valid JSON.`,
    userMessage: `Write a blog post for the "${context.pillar.replace(/_/g, ' ').toLowerCase()}" content pillar.

Services offered: ${context.topServices.join(', ') || 'various services'}

Recent topics to avoid repeating: ${context.recentTopics.slice(0, 5).join('; ') || 'none'}

Respond ONLY with JSON in this format:
{
  "title": "Blog post title (max 100 chars)",
  "body": "Full blog post content (800-1200 words, markdown formatted)"
}`,
  };
}

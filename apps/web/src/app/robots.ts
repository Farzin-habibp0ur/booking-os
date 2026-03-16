import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/inbox', '/settings', '/api', '/marketing'],
      },
    ],
    sitemap: 'https://businesscommandcentre.com/sitemap.xml',
  };
}

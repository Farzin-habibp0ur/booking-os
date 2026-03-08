import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/inbox', '/settings', '/console', '/api'],
      },
    ],
    sitemap: 'https://businesscommandcentre.com/sitemap.xml',
  };
}

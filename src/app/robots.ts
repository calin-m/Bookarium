import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/config/site-config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/privacy', '/read/'],
        disallow: [
          '/*?*search=*',
          '/*?*topic=*',
          '/*?*languages=*',
          '/api/*',
          '/auth/*',
          '/account',
        ],
      },
    ],
    sitemap: `${SITE_CONFIG.SITE_URL}/sitemap.xml`,
  };
}


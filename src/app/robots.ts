import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/config/site-config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/privacy', '/copyright', '/read/', '/u/'],
        disallow: [
          '/*?*search=*',
          '/*?*topic=*',
          '/*?*languages=*',
          '/*?*sort=*',
          '/*?*era=*',
          '/*?*format=*',
          '/*?*mime_type=*',
          '/*?*page=*',
          '/*?*size=*',
          '/*?*view=*',
          '/api/*',
          '/auth/*',
          '/account',
        ],
      },
    ],
    sitemap: `${SITE_CONFIG.SITE_URL}/sitemap.xml`,
  };
}


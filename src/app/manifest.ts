import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/config/site-config';

/**
 * Web App Manifest for Bookarium PWA (Progressive Web App).
 * Enables native 1-click installation on iOS, Android, macOS, and Windows
 * with standalone chromeless window presentation.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bookarium — Universal Public Domain Library & Reader',
    short_name: 'Bookarium',
    description: SITE_CONFIG.DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#fcfbf9',
    theme_color: '#0e1117',
    orientation: 'any',
    categories: ['books', 'education', 'literature', 'reference'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}


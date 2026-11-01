import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/config/site-config';

/**
 * Web App Manifest for Bookarium PWA (Progressive Web App).
 * Enables native 1-click installation on iOS, Android, macOS, and Windows
 * with standalone chromeless window presentation.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/?source=pwa',
    scope: '/',
    name: 'Bookarium — Universal Public Domain Library & Reader',
    short_name: 'Bookarium',
    description: SITE_CONFIG.DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#fcfbf9',
    theme_color: '#c05621',
    orientation: 'any',
    categories: ['books', 'education', 'literature', 'reference'],
    icons: [
      {
        src: '/icon.svg?v=2',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png?v=2',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png?v=2',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-1024.png?v=2',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png?v=2',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png?v=2',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}


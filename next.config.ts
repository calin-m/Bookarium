import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.gutenberg.org' },
      { protocol: 'https', hostname: 'gutenberg.org' },
    ],
  },
  async rewrites() {
    return [
      { source: '/catalog', destination: '/' },
      { source: '/bookshelf', destination: '/' },
      { source: '/favorites', destination: '/' },
      { source: '/notebook', destination: '/' },
      { source: '/bookmarks', destination: '/' },
    ];
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';

    const connectSrc = [
      "'self'",
      'https://*.supabase.co',
      'https://gutendex.com',
      'https://translate.googleapis.com',
      ...(isDev
        ? [
            'ws:',
            'wss:',
            'http://localhost:*',
            'http://127.0.0.1:*',
            'ws://localhost:*',
            'ws://127.0.0.1:*',
          ]
        : []),
    ].join(' ');

    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com data:;
      img-src 'self' data: blob: https://www.gutenberg.org https://gutenberg.org;
      connect-src ${connectSrc};
      frame-ancestors 'none';
      form-action 'self';
      base-uri 'self';
    `.replace(/\s{2,}/g, ' ').trim();

    const headersList: { key: string; value: string }[] = [
      { key: 'Content-Security-Policy', value: cspHeader },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];

    if (!isDev) {
      headersList.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      });
    }

    return [
      {
        source: '/(.*)',
        headers: headersList,
      },
    ];
  },
};

export default nextConfig;


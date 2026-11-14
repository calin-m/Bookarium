import type { NextConfig } from 'next';
import fs from 'fs';
import path from 'path';

function resolveBuildGitRepoUrl(): string {
  if (process.env.NEXT_PUBLIC_GITHUB_REPO) {
    return process.env.NEXT_PUBLIC_GITHUB_REPO.trim();
  }
  if (process.env.BOOKARIUM_REPO_URL) {
    return process.env.BOOKARIUM_REPO_URL.trim();
  }
  if (process.env.GITHUB_REPOSITORY) {
    return `https://github.com/${process.env.GITHUB_REPOSITORY.trim().replace(/^\/+|\/+$/g, '')}`;
  }
  if (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG) {
    return `https://github.com/${process.env.VERCEL_GIT_REPO_OWNER.trim()}/${process.env.VERCEL_GIT_REPO_SLUG.trim()}`;
  }
  try {
    const gitConfigPath = path.join(process.cwd(), '.git', 'config');
    if (fs.existsSync(gitConfigPath)) {
      const content = fs.readFileSync(gitConfigPath, 'utf8');
      const match = content.match(/url\s*=\s*(.+)/);
      if (match && match[1]) {
        return match[1].trim().replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');
      }
    }
  } catch {}
  return 'https://github.com/calin-m/Bookarium';
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_GITHUB_REPO: resolveBuildGitRepoUrl(),
  },
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
      script-src 'self' ${isDev ? "'unsafe-eval' " : ''}'unsafe-inline' https://challenges.cloudflare.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com data:;
      img-src 'self' data: blob: https://www.gutenberg.org https://gutenberg.org;
      connect-src ${connectSrc};
      frame-src 'self' https://challenges.cloudflare.com;
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

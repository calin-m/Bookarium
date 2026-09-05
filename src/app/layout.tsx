import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import { SITE_CONFIG } from '@/config/site-config';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfbf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1117' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.SITE_URL),
  title: {
    default: 'Bookarium | Zero-Copyright Public Domain Library',
    template: '%s | Bookarium',
  },
  description:
    'Discover, read, and download 70,000+ timeless books legally in the public domain. In-browser focus reader and direct EPUB/TXT downloads with zero API keys.',
  keywords: [
    'Public Domain Books',
    'Project Gutenberg',
    'Free Ebooks',
    'EPUB Download',
    'Zero Copyright',
    'Classic Literature',
    'Philosophy',
  ],
  authors: [{ name: `${SITE_CONFIG.NAME} Team` }],
  creator: `${SITE_CONFIG.NAME} Team`,
  publisher: SITE_CONFIG.NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_CONFIG.SITE_URL,
    siteName: SITE_CONFIG.NAME,
    title: 'Bookarium | Zero-Copyright Public Domain Library',
    description:
      'Discover, read, and download 70,000+ timeless books legally in the public domain. In-browser focus reader and direct EPUB/TXT downloads with zero API keys.',
    images: [
      {
        url: '/icons/apple-touch-icon.png',
        width: 180,
        height: 180,
        alt: 'Bookarium Logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Bookarium | Zero-Copyright Public Domain Library',
    description:
      'Discover, read, and download 70,000+ timeless books legally in the public domain. In-browser focus reader and direct EPUB/TXT downloads with zero API keys.',
    images: ['/icons/apple-touch-icon.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Bookarium',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_CONFIG.NAME,
  url: SITE_CONFIG.SITE_URL,
  description: SITE_CONFIG.DESCRIPTION,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_CONFIG.SITE_URL}/?search={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${playfair.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <link rel="preconnect" href={SITE_CONFIG.GUTENDEX} />
        <link rel="dns-prefetch" href={SITE_CONFIG.GUTENDEX} />
        <link rel="preconnect" href={SITE_CONFIG.PROJECT_GUTENBERG} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={SITE_CONFIG.PROJECT_GUTENBERG} />
        <script
          type="application/ld+json"
        >
          {JSON.stringify(websiteJsonLd)}
        </script>
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col bg-background text-foreground antialiased font-sans"
      >
        <Providers>
          {children}
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}

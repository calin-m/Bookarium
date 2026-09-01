import type { Metadata } from 'next';
import { Playfair_Display, Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import { SITE_CONFIG } from '@/config/site-config';
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

export const metadata: Metadata = {
  title: 'Bookarium | Zero-Copyright Public Domain Library',
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
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col bg-background text-foreground antialiased font-sans"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

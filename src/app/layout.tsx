import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

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
  authors: [{ name: 'Bookarium Team' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col bg-background text-foreground antialiased font-sans"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

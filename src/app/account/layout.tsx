import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account Settings & Preferences',
  description: 'Manage reading themes, navigation preferences, and cloud bookshelf synchronization.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}


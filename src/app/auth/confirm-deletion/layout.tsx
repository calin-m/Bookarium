import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Confirm Account Deletion',
  description: 'Confirm permanent account and cloud data deletion on Bookarium.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ConfirmDeletionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

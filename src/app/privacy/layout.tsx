import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy & Data Architecture',
  description:
    'Bookarium is engineered with an uncompromising commitment to digital sovereignty: zero tracking cookies, zero marketing networks, and zero monetization of your reading habits.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Privacy & Data Architecture | Bookarium',
    description:
      'Zero tracking cookies, zero advertising networks, and 100% digital sovereignty under EU ePrivacy and GDPR.',
    url: 'https://bookarium.vercel.app/privacy',
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}


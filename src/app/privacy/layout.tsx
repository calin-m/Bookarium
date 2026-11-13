import type { Metadata } from 'next';
import { SITE_CONFIG } from '@/config/site-config';

const PRIVACY_TITLE = 'Privacy & Data Architecture';
const PRIVACY_DESCRIPTION =
  'Bookarium is engineered with an uncompromising commitment to digital sovereignty: zero tracking cookies, zero marketing networks, and zero monetization of your reading habits.';
const PRIVACY_OG_DESCRIPTION =
  'Zero tracking cookies, zero advertising networks, and 100% digital sovereignty under EU ePrivacy and GDPR.';

export const metadata: Metadata = {
  title: PRIVACY_TITLE,
  description: PRIVACY_DESCRIPTION,
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: SITE_CONFIG.NAME,
    title: `${PRIVACY_TITLE} | ${SITE_CONFIG.NAME}`,
    description: PRIVACY_OG_DESCRIPTION,
    url: `${SITE_CONFIG.SITE_URL}/privacy`,
  },
  twitter: {
    card: 'summary',
    title: `${PRIVACY_TITLE} | ${SITE_CONFIG.NAME}`,
    description: PRIVACY_OG_DESCRIPTION,
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}


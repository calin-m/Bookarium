import type { Metadata } from 'next';
import { SITE_CONFIG } from '@/config/site-config';

const COPYRIGHT_TITLE = 'Copyright & Public Domain Governance';
const COPYRIGHT_DESCRIPTION =
  'Multi-jurisdictional public domain clearance (US 1930, Life+70, Life+80, Life+100), RFC 7725 HTTP 451 enforcement, and Project Gutenberg Robot Access compliance.';

export const metadata: Metadata = {
  title: COPYRIGHT_TITLE,
  description: COPYRIGHT_DESCRIPTION,
  alternates: {
    canonical: '/copyright',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: SITE_CONFIG.NAME,
    title: `${COPYRIGHT_TITLE} | ${SITE_CONFIG.NAME}`,
    description: COPYRIGHT_DESCRIPTION,
    url: `${SITE_CONFIG.SITE_URL}/copyright`,
  },
  twitter: {
    card: 'summary',
    title: `${COPYRIGHT_TITLE} | ${SITE_CONFIG.NAME}`,
    description: COPYRIGHT_DESCRIPTION,
  },
};

export default function CopyrightLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

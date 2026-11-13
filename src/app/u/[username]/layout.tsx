import { cache } from 'react';
import type { Metadata } from 'next';
import { SITE_CONFIG } from '@/config/site-config';
import { isClientSideNavigation } from '@/lib/server-rsc-nav';
import {
  fetchPublicScholarProfileSummary,
  hasCachedScholarProfile,
  type PublicScholarResolution,
} from './profile-layout-utils';

interface PublicProfileLayoutProps {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}

const FALLBACK_TITLE = 'Scholar Sanctuary';
const FALLBACK_DESCRIPTION =
  'Explore curated reading sanctuaries, Ex-Libris bookplates, and public domain literary lists on Bookarium.';

const resolveProfileForRequest = cache(
  async (rawUsername: string): Promise<PublicScholarResolution> => {
    const isClientTransition = await isClientSideNavigation();
    if (isClientTransition && !hasCachedScholarProfile(rawUsername)) {
      return { status: 'unavailable' };
    }
    return fetchPublicScholarProfileSummary(rawUsername);
  }
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const resolution = await resolveProfileForRequest(username);

  if (resolution.status === 'public') {
    const { profile } = resolution;
    const displayName = profile.display_name?.trim() || `@${profile.username}`;
    const pageTitle = `${displayName} (@${profile.username})`;
    const description =
      profile.bio?.trim() ||
      `Explore ${displayName}'s public reading sanctuary, pinned Ex-Libris bookplates, and curated classic shelves on Bookarium.`;
    const canonicalPath = `/u/${encodeURIComponent(profile.username.toLowerCase())}`;

    return {
      title: pageTitle,
      description,
      alternates: {
        canonical: canonicalPath,
      },
      openGraph: {
        type: 'profile',
        locale: 'en_US',
        siteName: SITE_CONFIG.NAME,
        title: `${pageTitle} | ${SITE_CONFIG.NAME}`,
        description,
        url: `${SITE_CONFIG.SITE_URL}${canonicalPath}`,
      },
      twitter: {
        card: 'summary',
        title: `${pageTitle} | ${SITE_CONFIG.NAME}`,
        description,
      },
    };
  }

  if (resolution.status === 'private_or_missing') {
    return {
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: FALLBACK_TITLE,
    description: FALLBACK_DESCRIPTION,
  };
}

export default async function PublicProfileLayout({
  children,
  params,
}: PublicProfileLayoutProps) {
  const { username } = await params;
  const resolution = await resolveProfileForRequest(username);

  let profileJsonLd: Record<string, unknown> | null = null;
  if (resolution.status === 'public') {
    const { profile } = resolution;
    const displayName = profile.display_name?.trim() || `@${profile.username}`;
    const profileUrl = `${SITE_CONFIG.SITE_URL}/u/${encodeURIComponent(profile.username.toLowerCase())}`;

    profileJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      mainEntity: {
        '@type': 'Person',
        name: displayName,
        alternateName: `@${profile.username}`,
        ...(profile.bio?.trim() ? { description: profile.bio.trim() } : {}),
        url: profileUrl,
      },
    };
  }

  return (
    <>
      {profileJsonLd && (
        <script type="application/ld+json">{JSON.stringify(profileJsonLd)}</script>
      )}
      {children}
    </>
  );
}

import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { SITE_CONFIG } from '@/config/site-config';
import { ROUTES } from '@/config/routes';
import { isClientSideNavigation } from '@/lib/server-rsc-nav';
import { CARD_DIMENSIONS } from '@/lib/share-card-primitives';
import { decodeProfileCardShareToken } from '@/lib/profile-card-export';
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
    const trimmedBio = profile.bio?.trim();
    const formattedBioDescription =
      trimmedBio && profile.bio_book_id && profile.bio_book_title?.trim()
        ? `“${trimmedBio}” — ${profile.bio_book_title.trim()}`
        : trimmedBio;
    const description =
      formattedBioDescription ||
      `Explore ${displayName}'s public reading sanctuary, pinned Ex-Libris bookplates, and curated classic shelves on Bookarium.`;
    const canonicalPath = `/u/${encodeURIComponent(profile.username.toLowerCase())}`;

    let validShareToken: string | null = null;
    try {
      const headersList = await headers();
      const rawToken = headersList.get('x-bookarium-share-token');
      if (rawToken && decodeProfileCardShareToken(profile.username, rawToken)) {
        validShareToken = rawToken;
      }
    } catch {
      // Non-blocking fallback outside request context
    }

    const cardImageUrl = `${SITE_CONFIG.SITE_URL}${ROUTES.API_PROFILE_CARD}?username=${encodeURIComponent(
      profile.username.toLowerCase()
    )}${validShareToken ? `&s=${validShareToken}` : ''}`;

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
        images: [
          {
            url: cardImageUrl,
            width: CARD_DIMENSIONS.width,
            height: CARD_DIMENSIONS.height,
            alt: `${pageTitle} — Bookarium Scholar Card`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${pageTitle} | ${SITE_CONFIG.NAME}`,
        description,
        images: [cardImageUrl],
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
    const trimmedBio = profile.bio?.trim();
    const formattedBioDescription =
      trimmedBio && profile.bio_book_id && profile.bio_book_title?.trim()
        ? `“${trimmedBio}” — ${profile.bio_book_title.trim()}`
        : trimmedBio;
    const profileUrl = `${SITE_CONFIG.SITE_URL}/u/${encodeURIComponent(profile.username.toLowerCase())}`;

    profileJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      mainEntity: {
        '@type': 'Person',
        name: displayName,
        alternateName: `@${profile.username}`,
        ...(formattedBioDescription ? { description: formattedBioDescription } : {}),
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

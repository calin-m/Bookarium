import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { headers } from 'next/headers';
import PublicProfileLayout, { generateMetadata } from './layout';
import * as profileUtils from './profile-layout-utils';
import { SITE_CONFIG } from '@/config/site-config';
import { encodeProfileCardShareToken } from '@/lib/profile-card-export';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('PublicProfileLayout and generateMetadata', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    profileUtils.clearServerProfileCache();
    vi.mocked(headers).mockResolvedValue(new Headers());
  });

  it('generates rich profile metadata, canonical URL, Twitter card, and ProfilePage JSON-LD for public scholars', async () => {
    vi.spyOn(profileUtils, 'fetchPublicScholarProfileSummary').mockResolvedValue({
      status: 'public',
      profile: {
        username: 'jane_austen',
        display_name: 'Jane Austen',
        bio: 'Regency satirist & novelist.',
        is_public: true,
      },
    });

    const meta = await generateMetadata({
      params: Promise.resolve({ username: 'jane_austen' }),
    });

    expect(meta.title).toBe('Jane Austen (@jane_austen)');
    expect(meta.description).toBe('Regency satirist & novelist.');
    expect(meta.alternates?.canonical).toBe('/u/jane_austen');
    expect(meta.openGraph).toMatchObject({
      type: 'profile',
      siteName: SITE_CONFIG.NAME,
      title: `Jane Austen (@jane_austen) | ${SITE_CONFIG.NAME}`,
      url: `${SITE_CONFIG.SITE_URL}/u/jane_austen`,
      images: [
        {
          url: `${SITE_CONFIG.SITE_URL}/api/profiles/card?username=jane_austen`,
          width: 1200,
          height: 630,
        },
      ],
    });
    expect(meta.twitter).toMatchObject({
      card: 'summary_large_image',
      title: `Jane Austen (@jane_austen) | ${SITE_CONFIG.NAME}`,
      images: [`${SITE_CONFIG.SITE_URL}/api/profiles/card?username=jane_austen`],
    });

    const layoutJsx = await PublicProfileLayout({
      params: Promise.resolve({ username: 'jane_austen' }),
      children: <div data-testid="scholar-child">Profile Body</div>,
    });
    render(layoutJsx);

    expect(screen.getByTestId('scholar-child')).toBeInTheDocument();
    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const parsed = JSON.parse(script!.textContent || '{}');
    expect(parsed['@type']).toBe('ProfilePage');
    expect(parsed.mainEntity).toEqual({
      '@type': 'Person',
      name: 'Jane Austen',
      alternateName: '@jane_austen',
      description: 'Regency satirist & novelist.',
      url: `${SITE_CONFIG.SITE_URL}/u/jane_austen`,
    });
  });

  it('emits identical anti-enumeration noindex metadata and omits JSON-LD for private or nonexistent handles', async () => {
    vi.spyOn(profileUtils, 'fetchPublicScholarProfileSummary').mockResolvedValue({
      status: 'private_or_missing',
    });

    const meta = await generateMetadata({
      params: Promise.resolve({ username: 'private_or_ghost' }),
    });

    expect(meta.title).toBe('Scholar Sanctuary');
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.openGraph).toBeUndefined();
    expect(meta.twitter).toBeUndefined();

    const layoutJsx = await PublicProfileLayout({
      params: Promise.resolve({ username: 'private_or_ghost' }),
      children: <div data-testid="private-child">Sanctuary Notice</div>,
    });
    render(layoutJsx);

    expect(screen.getByTestId('private-child')).toBeInTheDocument();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('bypasses database lookup on uncached client-side RSC navigations without locking noindex', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ rsc: '1' }));
    const fetchSpy = vi.spyOn(profileUtils, 'fetchPublicScholarProfileSummary');

    const meta = await generateMetadata({
      params: Promise.resolve({ username: 'jane_austen' }),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(meta.title).toBe('Scholar Sanctuary');
    expect(meta.robots).toBeUndefined();
  });

  it('includes book attribution in OpenGraph and Schema.org descriptions when bio originates from a highlight', async () => {
    vi.spyOn(profileUtils, 'fetchPublicScholarProfileSummary').mockResolvedValue({
      status: 'public',
      profile: {
        username: 'jane_austen',
        display_name: 'Jane Austen',
        bio: 'Vanity and pride are different things.',
        bio_book_id: 1342,
        bio_book_title: 'Pride and Prejudice',
        bio_book_author: 'Jane Austen',
        is_public: true,
      },
    });

    const meta = await generateMetadata({
      params: Promise.resolve({ username: 'jane_austen' }),
    });

    expect(meta.description).toBe(
      '“Vanity and pride are different things.” — Pride and Prejudice'
    );
    expect(meta.openGraph?.description).toBe(
      '“Vanity and pride are different things.” — Pride and Prejudice'
    );

    const layoutJsx = await PublicProfileLayout({
      params: Promise.resolve({ username: 'jane_austen' }),
      children: <div>Profile Body</div>,
    });
    render(layoutJsx);

    const script = document.querySelector('script[type="application/ld+json"]');
    const parsed = JSON.parse(script!.textContent || '{}');
    expect(parsed.mainEntity.description).toBe(
      '“Vanity and pride are different things.” — Pride and Prejudice'
    );
  });

  it('forwards verified x-bookarium-share-token onto profile OpenGraph image URL and drops tampered tokens', async () => {
    vi.spyOn(profileUtils, 'fetchPublicScholarProfileSummary').mockResolvedValue({
      status: 'public',
      profile: {
        username: 'jane_austen',
        display_name: 'Jane Austen',
        bio: 'Regency satirist & novelist.',
        is_public: true,
      },
    });

    const validToken = encodeProfileCardShareToken({
      username: 'jane_austen',
      theme: 'sepia',
      includeStats: true,
    });
    vi.mocked(headers).mockResolvedValue(
      new Headers({ 'x-bookarium-share-token': validToken })
    );

    const signedMeta = await generateMetadata({
      params: Promise.resolve({ username: 'jane_austen' }),
    });
    expect(signedMeta.twitter).toMatchObject({
      card: 'summary_large_image',
      images: [`${SITE_CONFIG.SITE_URL}/api/profiles/card?username=jane_austen&s=${validToken}`],
    });

    const foreignToken = encodeProfileCardShareToken({
      username: 'other_scholar',
      theme: 'dark',
      includeStats: false,
    });
    vi.mocked(headers).mockResolvedValue(
      new Headers({ 'x-bookarium-share-token': foreignToken })
    );

    const fallbackMeta = await generateMetadata({
      params: Promise.resolve({ username: 'jane_austen' }),
    });
    expect(fallbackMeta.twitter).toMatchObject({
      card: 'summary_large_image',
      images: [`${SITE_CONFIG.SITE_URL}/api/profiles/card?username=jane_austen`],
    });
  });
});

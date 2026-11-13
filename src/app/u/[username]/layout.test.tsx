import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { headers } from 'next/headers';
import PublicProfileLayout, { generateMetadata } from './layout';
import * as profileUtils from './profile-layout-utils';
import { SITE_CONFIG } from '@/config/site-config';

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
    });
    expect(meta.twitter).toMatchObject({
      card: 'summary',
      title: `Jane Austen (@jane_austen) | ${SITE_CONFIG.NAME}`,
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
});

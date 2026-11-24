import { describe, it, expect, vi } from 'vitest';
import { SITE_CONFIG } from '@/config/site-config';
import { CARD_DIMENSIONS } from './share-card-primitives';
import {
  resolveScholarInitials,
  buildProfileCardStatPills,
  computeProfileCardTokenSignature,
  encodeProfileCardShareToken,
  decodeProfileCardShareToken,
  buildProfileCardShareUrl,
  buildProfileShareText,
  renderProfileCardToCanvas,
} from './profile-card-export';

function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 }) as TextMetrics),
  } as unknown as CanvasRenderingContext2D;
}

describe('profile-card-export', () => {
  it('derives monogram initials cleanly across full names, single handles, and missing values', () => {
    expect(resolveScholarInitials('Jane Austen', 'jane_austen')).toBe('JA');
    expect(resolveScholarInitials('Aristotle', 'stagyrite')).toBe('AR');
    expect(resolveScholarInitials(null, '@marcus')).toBe('MA');
    expect(resolveScholarInitials(null, null)).toBe('BS');
  });

  it('builds at most 4 privacy-gated scholar metric pills respecting visibility toggles', () => {
    expect(
      buildProfileCardStatPills({
        showStreak: true,
        showChallenge: true,
        showBookshelves: true,
        currentStreak: 14,
        annualGoal: 25,
        completedBooksCount: 10,
        pinnedAccoladesCount: 2,
        publicShelvesCount: 1,
      })
    ).toEqual(['14d Streak', '10/25 Goal', '2 Bookplates', '1 Shelf']);

    expect(
      buildProfileCardStatPills({
        showStreak: false,
        showChallenge: false,
        showBookshelves: false,
        currentStreak: 14,
        annualGoal: 25,
        completedBooksCount: 10,
        pinnedAccoladesCount: 1,
        publicShelvesCount: 4,
      })
    ).toEqual(['1 Bookplate']);
  });

  it('encodes visual-only share tokens bound to normalized handle and rejects cross-handle replays or tampering', () => {
    const token = encodeProfileCardShareToken({
      username: 'Jane_Austen',
      theme: 'sepia',
      includeStats: false,
    });

    const decodedLower = decodeProfileCardShareToken('jane_austen', token);
    expect(decodedLower).toEqual({
      theme: 'sepia',
      includeStats: false,
    });

    // Dark theme + includeStats=true round-trip
    const darkToken = encodeProfileCardShareToken({
      username: 'jane_austen',
      theme: 'dark',
      includeStats: true,
    });
    expect(decodeProfileCardShareToken('jane_austen', darkToken)).toEqual({
      theme: 'dark',
      includeStats: true,
    });

    // Replay across different scholar handle fails signature check
    expect(decodeProfileCardShareToken('charlotte_bronte', token)).toBeNull();
    // Tampered / invalid handle / malformed inputs rejected
    expect(decodeProfileCardShareToken('jane_austen', `${token.slice(0, -1)}X`)).toBeNull();
    expect(decodeProfileCardShareToken('', token)).toBeNull();
    expect(decodeProfileCardShareToken('jane_austen', null)).toBeNull();

    // Verify independent domain salt compared to plain raw signature expectation
    expect(computeProfileCardTokenSignature('jane_austen', 's.0')).toMatch(/^[a-z0-9]+$/);
  });

  it('builds canonical share URLs and literary share copy with motto excerpt or default fallback', () => {
    const url = buildProfileCardShareUrl(`${SITE_CONFIG.SITE_URL}/`, {
      username: 'Jane_Austen',
      theme: 'light',
      includeStats: true,
    });
    expect(url).toMatch(
      new RegExp(`^${SITE_CONFIG.SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/u/jane_austen\\?s=[A-Za-z0-9_-]+$`)
    );

    expect(
      buildProfileCardShareUrl(SITE_CONFIG.SITE_URL, {
        username: '   ',
        theme: 'light',
      })
    ).toBe(`${SITE_CONFIG.SITE_URL}/`);

    const withBio = buildProfileShareText({
      username: 'jane_austen',
      displayName: 'Jane Austen',
      initials: 'JA',
      memberSince: 'June 2025',
      bio: 'A'.repeat(130),
      theme: 'light',
    });
    expect(withBio).toContain('…');
    expect(withBio).toContain('Jane Austen (@jane_austen)');

    const withoutBio = buildProfileShareText({
      username: 'jane_austen',
      displayName: 'Jane Austen',
      initials: 'JA',
      memberSince: 'June 2025',
      bio: null,
      theme: 'sepia',
    });
    expect(withoutBio).toContain('curated public bookshelves');
  });

  it('renders Scholar Sanctuary 1200x630 canvas with monogram seal, motto attribution, and stats pills', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValueOnce(null);
    expect(
      renderProfileCardToCanvas(canvas, {
        username: 'jane_austen',
        displayName: 'Jane Austen',
        initials: 'JA',
        memberSince: 'June 2025',
        theme: 'light',
      })
    ).toBe(false);

    const mockCtx = createMockCanvasContext();
    vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx);

    const rendered = renderProfileCardToCanvas(canvas, {
      username: 'Jane_Austen',
      displayName: 'Jane Austen',
      initials: 'JA',
      memberSince: 'June 2025',
      bio: 'It is a truth universally acknowledged.',
      bioBookTitle: 'Pride and Prejudice',
      bioBookAuthor: 'Jane Austen',
      theme: 'dark',
      includeStats: true,
      statsPills: ['14d Streak', '10/25 Goal'],
      siteHost: 'bookarium.app',
    });

    expect(rendered).toBe(true);
    expect(canvas.width).toBe(CARD_DIMENSIONS.width);
    expect(canvas.height).toBe(CARD_DIMENSIONS.height);
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      'BOOKARIUM  •  PUBLIC SCHOLAR',
      expect.any(Number),
      expect.any(Number)
    );
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      'SCHOLAR SINCE JUNE 2025',
      expect.any(Number),
      expect.any(Number)
    );
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      '— Pride and Prejudice, Jane Austen',
      expect.any(Number),
      expect.any(Number)
    );
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      '14d Streak',
      expect.any(Number),
      expect.any(Number)
    );
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      'bookarium.app/u/jane_austen',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('renders fallback literary copy and hides stat pills when includeStats is false', () => {
    const canvas = document.createElement('canvas');
    const mockCtx = createMockCanvasContext();
    vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx);

    renderProfileCardToCanvas(canvas, {
      username: 'anonymous_reader',
      displayName: 'Anonymous Reader',
      initials: 'AR',
      memberSince: 'January 2026',
      bio: null,
      theme: 'sepia',
      includeStats: false,
      statsPills: ['5d Streak'],
    });

    expect(mockCtx.fillText).not.toHaveBeenCalledWith(
      '5d Streak',
      expect.any(Number),
      expect.any(Number)
    );
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      expect.stringContaining('Curated public domain shelves'),
      expect.any(Number),
      expect.any(Number)
    );
  });
});

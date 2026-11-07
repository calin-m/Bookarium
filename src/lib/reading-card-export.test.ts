import { describe, it, expect, vi } from 'vitest';
import {
  CARD_DIMENSIONS,
  CARD_PALETTES,
  wrapCanvasText,
  renderReadingCardToCanvas,
  exportReadingCardBlob,
  buildReadingShareText,
  buildSocialShareUrls,
  encodeReadingCardShareToken,
  decodeReadingCardShareToken,
  buildReadingCardShareUrl,
} from './reading-card-export';

function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 }) as TextMetrics),
  } as unknown as CanvasRenderingContext2D;
}

describe('reading-card-export', () => {
  describe('wrapCanvasText', () => {
    it('returns empty array for empty or whitespace-only text', () => {
      const ctx = createMockCanvasContext();
      expect(wrapCanvasText(ctx, '   ', 300, 3)).toEqual([]);
    });

    it('wraps words across multiple lines within maxWidth and truncates with ellipsis when exceeding maxLines', () => {
      const ctx = createMockCanvasContext();
      const lines = wrapCanvasText(
        ctx,
        'The quick brown fox jumps over the lazy sleeping dog in the sunny meadow',
        200,
        2
      );
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('The quick brown fox');
      expect(lines[1].endsWith('…')).toBe(true);
    });

    it('keeps a single short line intact without truncation', () => {
      const ctx = createMockCanvasContext();
      const lines = wrapCanvasText(ctx, 'Pride and Prejudice', 500, 3);
      expect(lines).toEqual(['Pride and Prejudice']);
    });
  });

  describe('renderReadingCardToCanvas', () => {
    it('returns false when canvas 2d context is unavailable', () => {
      const canvas = document.createElement('canvas');
      vi.spyOn(canvas, 'getContext').mockReturnValue(null);

      const rendered = renderReadingCardToCanvas(canvas, {
        bookId: 1342,
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        theme: 'light',
      });
      expect(rendered).toBe(false);
    });

    it('renders archival bookplate card with reading progress bar across light, sepia, and dark themes', () => {
      const canvas = document.createElement('canvas');
      const mockCtx = createMockCanvasContext();
      vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx);

      const renderedLight = renderReadingCardToCanvas(canvas, {
        bookId: 1342,
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        theme: 'light',
        progress: 64,
        currentSection: 12,
        totalSections: 61,
        includeProgress: true,
        siteHost: 'bookarium.app',
      });

      expect(renderedLight).toBe(true);
      expect(canvas.width).toBe(CARD_DIMENSIONS.width);
      expect(canvas.height).toBe(CARD_DIMENSIONS.height);
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        'BOOKARIUM  •  PUBLIC DOMAIN ARCHIVE',
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        'GUTENBERG #1342',
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        '64% COMPLETED',
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        'SECTION 12 OF 61',
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        'bookarium.app/read/1342',
        expect.any(Number),
        expect.any(Number)
      );

      // Sepia & Dark themes + long titles (>42 and >70 chars)
      const renderedSepia = renderReadingCardToCanvas(canvas, {
        bookId: 2701,
        title: 'Moby Dick; Or, The Whale by Herman Melville Complete Classic Edition',
        author: 'Herman Melville',
        theme: 'sepia',
        includeProgress: false,
        quote: 'Call me Ishmael.',
      });
      expect(renderedSepia).toBe(true);
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        '“Call me Ishmael.”',
        expect.any(Number),
        expect.any(Number)
      );

      const renderedDark = renderReadingCardToCanvas(canvas, {
        bookId: 84,
        title:
          'Frankenstein; Or, The Modern Prometheus — Original Unabridged 1818 Archival Edition',
        author: '',
        theme: 'dark',
        includeProgress: false,
      });
      expect(renderedDark).toBe(true);
      expect(CARD_PALETTES.dark.background).toBe('#0f0f0e');
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        'UNABRIDGED PUBLIC DOMAIN EDITION  •  FREE DIGITAL READER',
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  describe('exportReadingCardBlob', () => {
    it('resolves with a PNG Blob when canvas.toBlob succeeds', async () => {
      const canvas = document.createElement('canvas');
      const fakeBlob = new Blob(['png-bytes'], { type: 'image/png' });
      canvas.toBlob = vi.fn((cb: BlobCallback) => cb(fakeBlob));

      const result = await exportReadingCardBlob(canvas);
      expect(result).toBe(fakeBlob);
      expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    });

    it('resolves with null when canvas.toBlob is missing or throws', async () => {
      const canvas = document.createElement('canvas');
      Object.defineProperty(canvas, 'toBlob', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      expect(await exportReadingCardBlob(canvas)).toBeNull();

      canvas.toBlob = vi.fn(() => {
        throw new Error('SecurityError');
      });
      expect(await exportReadingCardBlob(canvas)).toBeNull();
    });
  });

  describe('buildReadingShareText & buildSocialShareUrls', () => {
    it('formats share text with or without reading progress', () => {
      const withProgress = buildReadingShareText({
        bookId: 1342,
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        theme: 'light',
        progress: 45,
        includeProgress: true,
      });
      expect(withProgress).toContain('Currently reading “Pride and Prejudice” by Jane Austen (45% completed)');

      const withoutProgress = buildReadingShareText({
        bookId: 1342,
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        theme: 'light',
        progress: 45,
        includeProgress: false,
      });
      expect(withoutProgress).toBe(
        'Reading “Pride and Prejudice” by Jane Austen on Bookarium — free public domain library.'
      );
    });

    it('builds all 8 zero-key social platform Web Intent URLs', () => {
      const targets = buildSocialShareUrls({
        url: 'https://bookarium.app/read/1342',
        title: 'Pride and Prejudice | Bookarium',
        text: 'Reading Pride and Prejudice on Bookarium',
      });

      expect(targets.map((t) => t.id)).toEqual([
        'x',
        'reddit',
        'whatsapp',
        'telegram',
        'bluesky',
        'facebook',
        'linkedin',
        'email',
      ]);
      for (const target of targets) {
        expect(target.href.length).toBeGreaterThan(10);
        expect(target.href).toContain(encodeURIComponent('https://bookarium.app/read/1342'));
      }
    });
  });

  describe('Signed Share Token Codec (encodeReadingCardShareToken & decodeReadingCardShareToken)', () => {
    it('roundtrips light, sepia, and dark themes with or without progress and rejects tampered or cross-book tokens', () => {
      const tokenSepia = encodeReadingCardShareToken({
        bookId: 1342,
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        theme: 'sepia',
        includeProgress: true,
        progress: 64,
        currentSection: 12,
        totalSections: 61,
      });

      expect(tokenSepia).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decodeReadingCardShareToken(1342, tokenSepia)).toEqual({
        theme: 'sepia',
        includeProgress: true,
        progress: 64,
        currentSection: 12,
        totalSections: 61,
      });

      // Cross-book replay must fail signature verification
      expect(decodeReadingCardShareToken(84, tokenSepia)).toBeNull();

      // Tampering with payload or signature must fail verification
      const tampered = `${tokenSepia.slice(0, -2)}AA`;
      expect(decodeReadingCardShareToken(1342, tampered)).toBeNull();

      // Dark theme without progress
      const tokenDark = encodeReadingCardShareToken({
        bookId: 84,
        title: 'Frankenstein',
        author: 'Mary Shelley',
        theme: 'dark',
        includeProgress: false,
        progress: 80,
      });
      expect(decodeReadingCardShareToken(84, tokenDark)).toEqual({
        theme: 'dark',
        includeProgress: false,
        progress: 80,
        currentSection: 1,
        totalSections: 1,
      });

      // Light theme roundtrip & buildReadingCardShareUrl
      const shareUrl = buildReadingCardShareUrl('https://bookarium.vercel.app/', {
        bookId: 2701,
        title: 'Moby-Dick',
        author: 'Herman Melville',
        theme: 'light',
        includeProgress: true,
        progress: 33,
        currentSection: 5,
        totalSections: 135,
      });
      expect(shareUrl).toMatch(/^https:\/\/bookarium\.vercel\.app\/read\/2701\?s=[A-Za-z0-9_-]+$/);

      // Invalid/malformed inputs return null safely
      expect(decodeReadingCardShareToken(1342, null)).toBeNull();
      expect(decodeReadingCardShareToken(1342, '')).toBeNull();
      expect(decodeReadingCardShareToken(1342, 'invalid!token')).toBeNull();
      expect(decodeReadingCardShareToken(0, tokenSepia)).toBeNull();
    });
  });
});

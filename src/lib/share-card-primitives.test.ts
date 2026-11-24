import { describe, it, expect, vi } from 'vitest';
import {
  CARD_DIMENSIONS,
  CARD_PALETTES,
  wrapCanvasText,
  drawCornerOrnaments,
  getSafe2DContext,
  drawCardArchivalFrame,
  drawCardFooterBar,
  exportCardBlob,
  buildSocialShareUrls,
  computeSaltedShareSignature,
  toBase64Url,
  fromBase64Url,
  encodeThemeCode,
  decodeThemeCode,
} from './share-card-primitives';

function createMockCtx(): CanvasRenderingContext2D {
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
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 }) as TextMetrics),
  } as unknown as CanvasRenderingContext2D;
}

describe('share-card-primitives', () => {
  it('wraps text lines cleanly and truncates overflow with ellipsis at maxLines', () => {
    const ctx = createMockCtx();
    expect(wrapCanvasText(ctx, '   \n\t  ', 300, 2)).toEqual([]);
    expect(wrapCanvasText(ctx, 'Single word', 400, 2)).toEqual(['Single word']);

    const wrapped = wrapCanvasText(
      ctx,
      'This remarkably verbose classical epigraph exceeds the horizontal margin constraint cleanly',
      180,
      2
    );
    expect(wrapped).toHaveLength(2);
    expect(wrapped[1].endsWith('…')).toBe(true);
  });

  it('draws archival borders, corner ornaments, and footer bar cleanly onto 1200x630 canvas', () => {
    const canvas = document.createElement('canvas');
    const mockCtx = createMockCtx();
    vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx);

    const metrics = drawCardArchivalFrame(canvas, CARD_PALETTES.sepia);
    expect(metrics).not.toBeNull();
    expect(canvas.width).toBe(CARD_DIMENSIONS.width);
    expect(canvas.height).toBe(CARD_DIMENSIONS.height);

    drawCornerOrnaments(mockCtx, 48, 48, 1000, 500, CARD_PALETTES.sepia.accent);
    drawCardFooterBar(
      mockCtx,
      CARD_PALETTES.sepia,
      metrics!,
      'Curated Public Domain Sanctuary',
      'bookarium.app/u/austen'
    );
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      'bookarium.app/u/austen',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('guards unsafe jsdom canvas getContext and throwing toBlob exports gracefully', async () => {
    const canvas = document.createElement('canvas');
    expect(getSafe2DContext(canvas)).toBeNull();

    vi.spyOn(canvas, 'getContext').mockImplementation(() => {
      throw new Error('2d unsupported');
    });
    expect(drawCardArchivalFrame(canvas, CARD_PALETTES.light)).toBeNull();

    const okBlob = new Blob(['png'], { type: 'image/png' });
    Object.defineProperty(canvas, 'toBlob', {
      configurable: true,
      value: (cb: (b: Blob | null) => void) => cb(okBlob),
    });
    await expect(exportCardBlob(canvas)).resolves.toBe(okBlob);

    Object.defineProperty(canvas, 'toBlob', {
      configurable: true,
      value: () => {
        throw new Error('Tainted canvas');
      },
    });
    await expect(exportCardBlob(canvas)).resolves.toBeNull();

    Object.defineProperty(canvas, 'toBlob', {
      configurable: true,
      value: undefined,
    });
    await expect(exportCardBlob(canvas)).resolves.toBeNull();
  });

  it('encodes Base64URL payloads, verifies salted signatures, and maps theme codes safely', () => {
    const encoded = toBase64Url('s.1.sig99xyz');
    expect(fromBase64Url(encoded)).toBe('s.1.sig99xyz');
    expect(fromBase64Url('short')).toBeNull();
    expect(fromBase64Url('bad!chars')).toBeNull();

    const sig1 = computeSaltedShareSignature('salt-a', 'alice', 's.1');
    const sig2 = computeSaltedShareSignature('salt-b', 'alice', 's.1');
    const sig3 = computeSaltedShareSignature('salt-a', 'bob', 's.1');
    expect(sig1).not.toBe(sig2);
    expect(sig1).not.toBe(sig3);

    expect(encodeThemeCode('light')).toBe('l');
    expect(encodeThemeCode('sepia')).toBe('s');
    expect(encodeThemeCode('dark')).toBe('d');
    expect(decodeThemeCode('l')).toBe('light');
    expect(decodeThemeCode('s')).toBe('sepia');
    expect(decodeThemeCode('d')).toBe('dark');
    expect(decodeThemeCode('x')).toBeNull();
  });

  it('builds encoded Web Intent URLs for all 8 supported platforms', () => {
    const targets = buildSocialShareUrls({
      url: 'https://bookarium.app/u/jane_austen',
      title: 'Jane Austen (@jane_austen) | Bookarium',
      text: 'Explore public classics',
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
    expect(targets[0].href).toContain('https://twitter.com/intent/tweet?');
    expect(targets[7].href).toContain('mailto:?subject=');
  });
});

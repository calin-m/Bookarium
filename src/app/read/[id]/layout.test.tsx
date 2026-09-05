import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import BookReaderLayout, { generateMetadata } from './layout';

describe('BookReaderLayout and generateMetadata', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates rich metadata for a curated hero classic (Frankenstein #84)', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ id: '84' }),
    });

    expect(meta.title).toContain('Frankenstein');
    expect(meta.title).toContain('Mary Wollstonecraft Shelley');
    expect(meta.description).toContain('Frankenstein');
    const og = meta.openGraph as Record<string, unknown> | undefined;
    const tw = meta.twitter as Record<string, unknown> | undefined;
    expect(og?.type).toBe('book');
    expect(tw?.card).toBe('summary_large_image');
    expect(meta.alternates?.canonical).toBe('/read/84');
  });

  it('provides safe fallback metadata for invalid book ID', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ id: 'invalid-id' }),
    });

    expect(meta.title).toBe('Book Reader');
    expect(meta.description).toBeDefined();
  });

  it('renders children and Schema.org Book JSON-LD script', async () => {
    const layoutJsx = await BookReaderLayout({
      params: Promise.resolve({ id: '84' }),
      children: <div data-testid="reader-child">Reader Content</div>,
    });

    render(layoutJsx);

    expect(screen.getByTestId('reader-child')).toBeInTheDocument();

    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    if (script) {
      const parsed = JSON.parse(script.textContent || '{}');
      expect(parsed['@type']).toBe('Book');
      expect(parsed.name).toContain('Frankenstein');
      expect(parsed.author?.name).toContain('Shelley');
    }
  });
});


import { describe, it, expect } from 'vitest';
import { extractGutenbergHeaderMetadata, normalizeLanguageToCode } from './metadata';

describe('metadata subsystem', () => {
  it('extracts Title and Author directly from Gutenberg header preamble', () => {
    const headerText = `
The Project Gutenberg eBook of Frankenstein; Or, The Modern Prometheus
Title: Frankenstein
       or, The Modern Prometheus
Author: Mary Wollstonecraft (Godwin) Shelley
Language: English
Release Date: October 31, 1993 [eBook #84]
    `;

    const meta = extractGutenbergHeaderMetadata(headerText);
    expect(meta.title).toBe('Frankenstein');
    expect(meta.author).toContain('Mary Wollstonecraft');
    expect(meta.language).toBe('en');

    // Multilingual Gutenberg headers
    const dutchHeader = `
Title: Gevoel en verstand
Author: Jane Austen
Language: Dutch
Translator: Gonne Loman-van Uildriks
    `;
    const dutchMeta = extractGutenbergHeaderMetadata(dutchHeader);
    expect(dutchMeta.title).toBe('Gevoel en verstand');
    expect(dutchMeta.author).toBe('Jane Austen');
    expect(dutchMeta.language).toBe('nl');

    const frenchHeader = `
Titre: Les Misérables
Auteur: Victor Hugo
Langue: French
    `;
    const frenchMeta = extractGutenbergHeaderMetadata(frenchHeader);
    expect(frenchMeta.title).toBe('Les Misérables');
    expect(frenchMeta.author).toBe('Victor Hugo');
    expect(frenchMeta.language).toBe('fr');

    expect(extractGutenbergHeaderMetadata(null)).toEqual({});
  });

  it('normalizes language names to standard codes', () => {
    expect(normalizeLanguageToCode('English')).toBe('en');
    expect(normalizeLanguageToCode('German')).toBe('de');
    expect(normalizeLanguageToCode('es')).toBe('es');
    expect(normalizeLanguageToCode(null)).toBeUndefined();
    expect(normalizeLanguageToCode('')).toBeUndefined();
  });
});


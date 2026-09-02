import { describe, it, expect } from 'vitest';
import {
  POPULAR_TRANSLATION_LANGUAGES,
  ALL_TRANSLATION_LANGUAGES,
  resolveTranslationLanguage,
} from './translation-languages';

describe('translation-languages', () => {
  it('contains curated popular languages with valid codes and flags', () => {
    expect(POPULAR_TRANSLATION_LANGUAGES.length).toBeGreaterThan(10);
    const spanish = POPULAR_TRANSLATION_LANGUAGES.find((l) => l.code === 'es');
    expect(spanish).toBeDefined();
    expect(spanish?.label).toBe('Spanish');
    expect(spanish?.flag).toBe('🇪🇸');
  });

  it('contains complete alphabetized language catalog', () => {
    expect(ALL_TRANSLATION_LANGUAGES.length).toBeGreaterThanOrEqual(40);
    for (const lang of ALL_TRANSLATION_LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.label).toBeTruthy();
      expect(lang.nativeLabel).toBeTruthy();
      expect(lang.flag).toBeTruthy();
    }
  });

  it('resolves languages correctly by full code or prefix', () => {
    expect(resolveTranslationLanguage('ro')?.label).toBe('Romanian');
    expect(resolveTranslationLanguage('FR')?.label).toBe('French');
    expect(resolveTranslationLanguage('zh-cn')?.label).toBe('Chinese (Simplified)');
    expect(resolveTranslationLanguage('unknown')).toBeUndefined();
    expect(resolveTranslationLanguage('')).toBeUndefined();
  });
});


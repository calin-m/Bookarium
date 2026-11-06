import { describe, it, expect } from 'vitest';
import {
  isNaturalVoice,
  cleanVoiceName,
  normalizeSpeechLang,
  isVoiceLanguageCompatible,
  getVoiceQualityScore,
  sortVoicesByQuality,
  resolveBestVoice,
} from './speech-utils';

describe('speech-utils', () => {
  describe('normalizeSpeechLang', () => {
    it('normalizes Android underscore locales to BCP-47 hyphenated tags', () => {
      expect(normalizeSpeechLang('en_US')).toBe('en-US');
      expect(normalizeSpeechLang('en_GB')).toBe('en-GB');
      expect(normalizeSpeechLang(' fr_FR ')).toBe('fr-FR');
      expect(normalizeSpeechLang(null)).toBe('');
      expect(normalizeSpeechLang(undefined)).toBe('');
    });
  });

  describe('isVoiceLanguageCompatible', () => {
    it('matches regional dialects of the target book language while rejecting unrelated languages', () => {
      expect(
        isVoiceLanguageCompatible({ lang: 'en-US' } as SpeechSynthesisVoice, 'en')
      ).toBe(true);
      expect(
        isVoiceLanguageCompatible({ lang: 'en_GB' } as SpeechSynthesisVoice, 'en-US')
      ).toBe(true);
      expect(
        isVoiceLanguageCompatible({ lang: 'en-AU' } as SpeechSynthesisVoice, 'en')
      ).toBe(true);
      expect(
        isVoiceLanguageCompatible({ lang: 'fr-FR' } as SpeechSynthesisVoice, 'en')
      ).toBe(false);
      expect(
        isVoiceLanguageCompatible({ lang: 'eo' } as SpeechSynthesisVoice, 'en')
      ).toBe(false);
      expect(isVoiceLanguageCompatible(null, 'en')).toBe(false);
    });
  });

  describe('isNaturalVoice', () => {
    it('returns true for high-definition neural, natural, voiceURI network/wavenet, and cloud voices', () => {
      expect(isNaturalVoice({ name: 'Microsoft Jenny Natural (Online)' } as any)).toBe(true);
      expect(isNaturalVoice({ name: 'Google US English' } as any)).toBe(true);
      expect(isNaturalVoice({ name: 'Apple Siri Voice 2' } as any)).toBe(true);
      expect(isNaturalVoice({ name: 'Samantha Enhanced' } as any)).toBe(true);
      expect(isNaturalVoice({ name: 'Neural Voice Engine' } as any)).toBe(true);
      expect(isNaturalVoice({ name: 'Aria Premium' } as any)).toBe(true);
      expect(
        isNaturalVoice({
          name: 'English (United States)',
          voiceURI: 'en-us-x-sfg-network',
          localService: true,
        } as any)
      ).toBe(true);
      expect(
        isNaturalVoice({
          name: 'English (United Kingdom)',
          voiceURI: 'en-gb-wavenet-a',
          localService: false,
        } as any)
      ).toBe(true);
    });

    it('returns false for standard mechanical or missing voice names', () => {
      expect(
        isNaturalVoice({ name: 'Microsoft David Desktop', localService: true } as any)
      ).toBe(false);
      expect(isNaturalVoice({ name: 'espeak-ng', localService: false } as any)).toBe(false);
      expect(isNaturalVoice({ name: 'Samantha', localService: true } as any)).toBe(false);
      expect(isNaturalVoice(null)).toBe(false);
      expect(isNaturalVoice(undefined)).toBe(false);
      expect(isNaturalVoice({} as any)).toBe(false);
    });
  });

  describe('cleanVoiceName', () => {
    it('removes vendor brand prefixes and trims whitespace', () => {
      expect(cleanVoiceName('Microsoft David Desktop')).toBe('David Desktop');
      expect(cleanVoiceName('Google UK English Female')).toBe('UK English Female');
      expect(cleanVoiceName('Apple Samantha')).toBe('Samantha');
      expect(cleanVoiceName('Natural Reader')).toBe('Natural Reader');
      expect(cleanVoiceName('')).toBe('');
    });
  });

  describe('getVoiceQualityScore', () => {
    it('awards highest points to natural/neural voices compatible with language and demotes mechanical', () => {
      const jenny = {
        name: 'Microsoft Jenny Natural (Online)',
        voiceURI: 'Microsoft Jenny Natural (Online)',
        lang: 'en-US',
      } as SpeechSynthesisVoice;
      const david = {
        name: 'Microsoft David Desktop',
        voiceURI: 'Microsoft David Desktop',
        lang: 'en-US',
      } as SpeechSynthesisVoice;
      const frenchVoice = {
        name: 'French Natural',
        voiceURI: 'fr-natural',
        lang: 'fr-FR',
      } as SpeechSynthesisVoice;

      expect(getVoiceQualityScore(jenny, 'en')).toBeGreaterThan(getVoiceQualityScore(david, 'en'));
      expect(getVoiceQualityScore(jenny, 'en')).toBeGreaterThan(getVoiceQualityScore(frenchVoice, 'en'));
      expect(getVoiceQualityScore(null, 'en')).toBe(0);
    });
  });

  describe('sortVoicesByQuality and resolveBestVoice', () => {
    const david = {
      name: 'Microsoft David Desktop',
      voiceURI: 'david-desktop',
      lang: 'en-US',
    } as SpeechSynthesisVoice;
    const jenny = {
      name: 'Microsoft Jenny Natural (Online)',
      voiceURI: 'jenny-natural',
      lang: 'en-US',
    } as SpeechSynthesisVoice;
    const standardGuy = {
      name: 'Standard Guy',
      voiceURI: 'standard-guy',
      lang: 'en-US',
    } as SpeechSynthesisVoice;
    const french = {
      name: 'Hortense Natural',
      voiceURI: 'fr-hortense',
      lang: 'fr-FR',
    } as SpeechSynthesisVoice;

    it('sorts voices prioritizing natural and language-matched voices first', () => {
      const sorted = sortVoicesByQuality([david, french, jenny, standardGuy], 'en');
      expect(sorted[0].voiceURI).toBe('jenny-natural');
      expect(sorted[1].voiceURI).toBe('standard-guy');
      expect(sortVoicesByQuality([] as any)).toEqual([]);
    });

    it('resolves best voice prioritizing preferredVoiceURI if compatible or defaulting to top ranked', () => {
      const bestAuto = resolveBestVoice([david, jenny, standardGuy], null, 'en');
      expect(bestAuto?.voiceURI).toBe('jenny-natural');

      const bestExplicit = resolveBestVoice([david, jenny, standardGuy], 'standard-guy', 'en');
      expect(bestExplicit?.voiceURI).toBe('standard-guy');

      expect(resolveBestVoice([])).toBeNull();
    });
  });
});


import { describe, it, expect } from 'vitest';
import {
  isNaturalVoice,
  cleanVoiceName,
  normalizeSpeechLang,
  isVoiceLanguageCompatible,
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
});


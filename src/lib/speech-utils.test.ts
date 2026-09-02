import { describe, it, expect } from 'vitest';
import { isNaturalVoice, cleanVoiceName } from './speech-utils';

describe('speech-utils', () => {
  describe('isNaturalVoice', () => {
    it('returns true for high-definition neural and natural voice names', () => {
      expect(isNaturalVoice({ name: 'Microsoft Jenny Natural (Online)' } as any)).toBe(true);
      expect(isNaturalVoice({ name: 'Google US English' } as any)).toBe(true);
      expect(isNaturalVoice({ name: 'Apple Siri Voice 2' } as any)).toBe(true);
      expect(isNaturalVoice({ name: 'Samantha Enhanced' } as any)).toBe(true);
      expect(isNaturalVoice({ name: 'Neural Voice Engine' } as any)).toBe(true);
      expect(isNaturalVoice({ name: 'Aria Premium' } as any)).toBe(true);
    });

    it('returns false for standard mechanical or missing voice names', () => {
      expect(isNaturalVoice({ name: 'Microsoft David Desktop' } as any)).toBe(false);
      expect(isNaturalVoice({ name: 'espeak-ng' } as any)).toBe(false);
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


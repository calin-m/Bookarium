import { describe, it, expect } from 'vitest';
import { segmentTextIntoSentences, isNaturalVoice } from './useReaderSpeech';

describe('speech utilities: isNaturalVoice', () => {
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
    expect(isNaturalVoice(null as any)).toBe(false);
    expect(isNaturalVoice({} as any)).toBe(false);
  });
});

describe('speech utilities: segmentTextIntoSentences', () => {
  it('splits paragraphs into punctuation-delimited sentences', () => {
    const raw = 'Call me Ishmael. Some years ago—never mind how long precisely—I took to the sea! Did you hear that?';
    const result = segmentTextIntoSentences(raw);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('Call me Ishmael.');
    expect(result[1]).toBe('Some years ago—never mind how long precisely—I took to the sea!');
    expect(result[2]).toBe('Did you hear that?');
  });

  it('handles quotes and dialogue gracefully', () => {
    const raw = '“It is a truth universally acknowledged,” said Mrs. Bennet. “That is all!”';
    const result = segmentTextIntoSentences(raw);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toContain('truth universally acknowledged');
  });

  it('returns empty array for empty or whitespace text', () => {
    expect(segmentTextIntoSentences('')).toEqual([]);
    expect(segmentTextIntoSentences('   \n\n  ')).toEqual([]);
  });
});


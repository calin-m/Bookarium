import { describe, it, expect } from 'vitest';
import { evaluateContentAdvisory, MATURE_CONTENT_KEYWORDS } from './content-advisory';

describe('content-advisory service', () => {
  it('returns false for clean public domain classical literature', () => {
    const result = evaluateContentAdvisory(
      ['Courtship -- Fiction', 'Sisters -- Fiction', 'England -- Social life and customs -- 19th century -- Fiction'],
      ['Best Books Ever Listings', 'Historical Fiction']
    );

    expect(result.isMature).toBe(false);
    expect(result.matchedSubject).toBeUndefined();
    expect(result.advisoryTitle).toBe('');
    expect(result.advisoryMessage).toBe('');
  });

  it('detects erotic literature keyword in subjects', () => {
    const result = evaluateContentAdvisory(
      ['Erotic literature', 'English literature -- 18th century'],
      ['Banned Books from Anne Haight\'s list']
    );

    expect(result.isMature).toBe(true);
    expect(result.matchedSubject).toBe('Erotic literature');
    expect(result.advisoryTitle).toBe('Historical Content Advisory');
    expect(result.advisoryMessage).toContain('Erotic literature');
  });

  it('detects sexual themes keyword in bookshelves', () => {
    const result = evaluateContentAdvisory(
      ['Rome -- History -- Empire, 30 B.C.-476 A.D. -- Fiction'],
      ['Erotica', 'Historical Novels']
    );

    expect(result.isMature).toBe(true);
    expect(result.matchedSubject).toBe('Erotica');
    expect(result.advisoryTitle).toBe('Historical Content Advisory');
  });

  it('detects other mature keywords like prostitution or sadism', () => {
    const r1 = evaluateContentAdvisory(['Prostitution -- France -- History -- Fiction']);
    expect(r1.isMature).toBe(true);

    const r2 = evaluateContentAdvisory(['Sadism -- Psychological aspects -- Fiction']);
    expect(r2.isMature).toBe(true);
  });

  it('handles empty, undefined, or malformed inputs gracefully', () => {
    expect(evaluateContentAdvisory().isMature).toBe(false);
    expect(evaluateContentAdvisory([], []).isMature).toBe(false);
    // @ts-expect-error testing runtime robustness
    expect(evaluateContentAdvisory([null, undefined, ''], [123]).isMature).toBe(false);
  });

  it('exports valid mature keywords list', () => {
    expect(MATURE_CONTENT_KEYWORDS.length).toBeGreaterThan(5);
    expect(MATURE_CONTENT_KEYWORDS).toContain('erotic');
    expect(MATURE_CONTENT_KEYWORDS).toContain('sex');
  });
});


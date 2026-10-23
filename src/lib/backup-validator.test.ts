import { describe, it, expect } from 'vitest';
import { validateLibraryBackup } from './backup-validator';

describe('backup-validator (validateLibraryBackup)', () => {
  it('rejects non-object inputs and arrays', () => {
    expect(validateLibraryBackup(null).valid).toBe(false);
    expect(validateLibraryBackup('string').valid).toBe(false);
    expect(validateLibraryBackup([1, 2, 3]).valid).toBe(false);
  });

  it('rejects payloads containing prototype pollution keys at root or nested levels', () => {
    const pollutedRoot = JSON.parse('{"__proto__": {"polluted": true}, "library": {"savedBooks": []}}');
    expect(validateLibraryBackup(pollutedRoot)).toEqual({
      valid: false,
      error: 'Invalid backup file: forbidden prototype modification detected.',
    });

    const pollutedNested = {
      app: 'Bookarium',
      library: {
        savedBooks: [],
        bookRatings: { constructor: 5 },
      },
    };
    expect(validateLibraryBackup(pollutedNested)).toEqual({
      valid: false,
      error: 'Invalid backup file: forbidden prototype modification detected.',
    });
  });

  it('rejects unrecognized application names and missing library sections', () => {
    expect(validateLibraryBackup({ app: 'OtherApp', library: { savedBooks: [] } })).toEqual({
      valid: false,
      error: 'Unrecognized backup application: expected Bookarium, got "OtherApp".',
    });

    expect(validateLibraryBackup({ app: 'Bookarium' })).toEqual({
      valid: false,
      error: 'Invalid backup file: missing required library section.',
    });

    expect(validateLibraryBackup({ app: 'Bookarium', library: { savedBooks: 'not-array' } })).toEqual({
      valid: false,
      error: 'Invalid backup file: library.savedBooks must be an array.',
    });
  });

  it('validates individual book items, custom shelves, readingQueue, annotations, and favorite lists', () => {
    expect(
      validateLibraryBackup({
        library: { savedBooks: [{ id: -1, title: 'Bad ID' }] },
      }).valid
    ).toBe(false);

    expect(
      validateLibraryBackup({
        library: { savedBooks: [], customShelves: 'invalid' },
      }).valid
    ).toBe(false);

    expect(
      validateLibraryBackup({
        library: { savedBooks: [], customShelves: [{ name: 123 }] },
      }).valid
    ).toBe(false);

    expect(
      validateLibraryBackup({
        library: { savedBooks: [], readingQueue: 'invalid' },
      }).valid
    ).toBe(false);

    expect(
      validateLibraryBackup({
        library: { savedBooks: [] },
        annotations: 'invalid',
      }).valid
    ).toBe(false);

    expect(
      validateLibraryBackup({
        library: { savedBooks: [], favoriteBookIds: 'invalid' },
      }).valid
    ).toBe(false);

    expect(
      validateLibraryBackup({
        library: { savedBooks: [], likedBookIds: 'invalid' },
      }).valid
    ).toBe(false);
  });

  it('normalizes valid backup payloads, sanitizes ratings/statuses, and falls back to likedBookIds', () => {
    const result = validateLibraryBackup({
      library: {
        savedBooks: [{ id: 1342, title: 'Pride and Prejudice' }],
        customShelves: [
          {
            name: '   ',
            bookIds: [1342, -5, 'invalid'],
          },
        ],
        readingQueue: [
          { id: 84, title: 'Frankenstein' },
          { id: 0, title: 'Invalid Queue Item' },
        ],
        bookRatings: {
          '1342': 5,
          '84': 99, // out of bounds
        },
        bookStatuses: {
          '1342': 'finished',
          '84': 'unknown_status',
        },
        likedBookIds: [1342, -1, 'bad'],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.data?.library.customShelves[0].name).toBe('Untitled Shelf');
    expect(result.data?.library.customShelves[0].bookIds).toEqual([1342]);
    expect(result.data?.library.readingQueue).toHaveLength(1);
    expect(result.data?.library.bookRatings).toEqual({ 1342: 5 });
    expect(result.data?.library.bookStatuses).toEqual({ 1342: 'finished' });
    expect(result.data?.library.favoriteBookIds).toEqual([1342]);
  });
});


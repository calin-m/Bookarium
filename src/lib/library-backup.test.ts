import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createLibraryBackup,
  downloadLibraryBackupJSON,
  exportLibraryToCSV,
  validateLibraryBackup,
  restoreLibraryBackup,
  type LibraryBackupPayload,
} from './library-backup';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useAnnotationStore } from '@/stores/useAnnotationStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useThemeStore } from '@/stores/useThemeStore';
import type { GutendexBook } from '@/types/book.types';

const mockBook1: GutendexBook = {
  id: 1342,
  title: 'Pride and Prejudice',
  authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
  translators: [],
  subjects: ['Courtship -- Fiction', 'Sisters -- Fiction'],
  bookshelves: ['Best Books Ever'],
  languages: ['en'],
  copyright: false,
  media_type: 'Text',
  formats: { 'text/html': 'https://www.gutenberg.org/ebooks/1342.html.images' },
  download_count: 50000,
};

const mockBook2: GutendexBook = {
  id: 84,
  title: 'Frankenstein; Or, The Modern Prometheus',
  authors: [{ name: 'Shelley, Mary Wollstonecraft', birth_year: 1797, death_year: 1851 }],
  translators: [],
  subjects: ['Monsters -- Fiction', 'Science fiction'],
  bookshelves: ['Gothic Fiction'],
  languages: ['en'],
  copyright: false,
  media_type: 'Text',
  formats: { 'text/html': 'https://www.gutenberg.org/ebooks/84.html.images' },
  download_count: 45000,
};

describe('library-backup domain engine', () => {
  beforeEach(() => {
    // Reset Zustand stores
    useBookshelfStore.setState({
      savedBooks: [mockBook1],
      readingQueue: [],
      likedBooks: [mockBook1],
      likedBookIds: [1342],
      cloudBookshelves: [
        {
          id: 'shelf-1',
          user_id: 'user-123',
          name: 'Classics',
          is_default: false,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
      cloudBookshelfItems: [
        {
          id: 'item-1',
          bookshelf_id: 'shelf-1',
          user_id: 'user-123',
          book_id: 1342,
          book_title: 'Pride and Prejudice',
          book_authors: ['Austen, Jane'],
          cover_url: null,
          added_at: '2026-01-01T00:00:00Z',
        },
      ],
      bookRatings: { 1342: 5 },
      bookStatuses: { 1342: 'finished' },
    });

    useReaderStore.setState({
      readingPositions: {
        1342: {
          chapterIndex: 2,
          chapterPage: 5,
          globalPage: 25,
          lastReadAt: '2026-09-01T12:00:00Z',
        },
      },
      readingProgress: {
        1342: 35,
      },
      fontSize: 18,
      lineHeight: 1.6,
      fontFamily: 'serif',
      theme: 'sepia',
    });

    useAnnotationStore.setState({
      annotations: [
        {
          id: 'ann-1',
          bookId: 1342,
          bookTitle: 'Pride and Prejudice',
          bookAuthor: 'Jane Austen',
          chapterIndex: 2,
          chapterPage: 5,
          selectedText: 'It is a truth universally acknowledged...',
          color: 'amber',
          note: 'Iconic opening sentence.',
          createdAt: '2026-09-01T12:05:00Z',
          updatedAt: '2026-09-01T12:05:00Z',
        },
      ],
    });

    useThemeStore.setState({ theme: 'sepia' });
    usePreferencesStore.setState({
      stickyScrollEnabled: true,
      speechRate: 1.15,
      speechVoiceURI: 'en-US-Standard',
      speechAutoPageAdvance: true,
      speechHighlightEnabled: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLibraryBackup', () => {
    it('generates a complete, structured backup payload from active stores', () => {
      const backup = createLibraryBackup();

      expect(backup.version).toBe('1.0');
      expect(backup.app).toBe('Bookarium');
      expect(backup.summary.bookCount).toBe(1);
      expect(backup.summary.customShelfCount).toBe(1);
      expect(backup.summary.favoriteCount).toBe(1);
      expect(backup.summary.annotationCount).toBe(1);
      expect(backup.summary.bookmarkCount).toBe(1);

      expect(backup.library.savedBooks).toHaveLength(1);
      expect(backup.library.savedBooks[0].title).toBe('Pride and Prejudice');
      expect(backup.library.likedBookIds).toEqual([1342]);
      expect(backup.library.customShelves).toHaveLength(1);
      expect(backup.library.customShelves[0].name).toBe('Classics');
      expect(backup.library.customShelves[0].bookIds).toEqual([1342]);
      expect(backup.library.bookRatings?.[1342]).toBe(5);
      expect(backup.library.bookStatuses?.[1342]).toBe('finished');

      expect(backup.reading.positions[1342].chapterIndex).toBe(2);
      expect(backup.reading.progress[1342]).toBe(35);
      expect(backup.annotations).toHaveLength(1);
      expect(backup.annotations[0].selectedText).toContain('universally acknowledged');

      expect(backup.preferences.theme).toBe('sepia');
      expect(backup.preferences.speech?.rate).toBe(1.15);
    });
  });

  describe('downloadLibraryBackupJSON', () => {
    it('creates a download blob and triggers click in DOM', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
      const revokeObjectURLMock = vi.fn();
      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;

      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      downloadLibraryBackupJSON();

      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('exportLibraryToCSV', () => {
    it('generates a valid CSV string with proper escaping and headers', () => {
      const csv = exportLibraryToCSV();
      const lines = csv.split('\r\n');

      expect(lines[0]).toBe(
        '"Book ID","Title","Authors","Shelves","Favorited","Rating","Status","Reading Progress (%)","Last Read At","Notes Count"'
      );
      expect(lines[1]).toContain('1342');
      expect(lines[1]).toContain('Pride and Prejudice');
      expect(lines[1]).toContain('Jane Austen');
      expect(lines[1]).toContain('Classics');
      expect(lines[1]).toContain('Yes');
      expect(lines[1]).toContain('5 / 5');
      expect(lines[1]).toContain('Finished');
      expect(lines[1]).toContain('35%');
      expect(lines[1]).toContain('1'); // 1 annotation note
    });

    it('escapes cells containing commas, quotes, and newlines', () => {
      const trickyBook: GutendexBook = {
        ...mockBook1,
        id: 9999,
        title: 'Title with "Quotes", and Commas',
        authors: [{ name: 'Author, John', birth_year: null, death_year: null }],
      };

      const customBackup = createLibraryBackup();
      customBackup.library.savedBooks.push(trickyBook);

      const csv = exportLibraryToCSV(customBackup);
      expect(csv).toContain('""Quotes""');
    });
  });

  describe('validateLibraryBackup', () => {
    it('accepts a valid backup payload', () => {
      const validPayload = createLibraryBackup();
      const result = validateLibraryBackup(validPayload);
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.library.savedBooks).toHaveLength(1);
    });

    it('rejects non-object raw inputs', () => {
      expect(validateLibraryBackup(null).valid).toBe(false);
      expect(validateLibraryBackup('string').valid).toBe(false);
      expect(validateLibraryBackup(12345).valid).toBe(false);
    });

    it('rejects payloads from foreign applications', () => {
      const result = validateLibraryBackup({ app: 'Calibre', library: { savedBooks: [] } });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expected Bookarium');
    });

    it('rejects missing library section', () => {
      const result = validateLibraryBackup({ app: 'Bookarium' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing required library section');
    });

    it('rejects invalid savedBooks structure', () => {
      const result = validateLibraryBackup({
        app: 'Bookarium',
        library: { savedBooks: 'not-an-array' },
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('savedBooks must be an array');
    });

    it('rejects corrupted book items inside savedBooks', () => {
      const result = validateLibraryBackup({
        app: 'Bookarium',
        library: {
          savedBooks: [{ id: 'not-a-number', title: 'Test' }],
        },
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing valid ID or title');
    });

    it('rejects non-array annotations or likedBookIds if provided', () => {
      const res1 = validateLibraryBackup({
        app: 'Bookarium',
        library: { savedBooks: [], likedBookIds: 'invalid' },
      });
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('likedBookIds must be an array');

      const res2 = validateLibraryBackup({
        app: 'Bookarium',
        library: { savedBooks: [] },
        annotations: 'invalid',
      });
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('annotations must be an array');
    });
  });

  describe('restoreLibraryBackup', () => {
    const incomingBackup: LibraryBackupPayload = {
      version: '1.0',
      app: 'Bookarium',
      exportedAt: '2026-09-02T10:00:00Z',
      summary: {
        bookCount: 1,
        customShelfCount: 1,
        favoriteCount: 1,
        annotationCount: 1,
        bookmarkCount: 1,
      },
      library: {
        savedBooks: [mockBook2],
        readingQueue: [],
        likedBookIds: [84],
        customShelves: [
          {
            id: 'shelf-sci-fi',
            name: 'Sci-Fi',
            isDefault: false,
            bookIds: [84],
          },
        ],
        bookRatings: { 84: 4 },
        bookStatuses: { 84: 'currently_reading' },
      },
      reading: {
        positions: {
          84: {
            chapterIndex: 1,
            chapterPage: 2,
            globalPage: 10,
            lastReadAt: '2026-09-03T15:00:00Z',
          },
          1342: {
            chapterIndex: 3,
            chapterPage: 1,
            globalPage: 30,
            lastReadAt: '2026-09-04T12:00:00Z', // Newer than existing Sept 1
          },
        },
        progress: {
          84: 20,
          1342: 50, // Higher than existing 35
        },
      },
      annotations: [
        {
          id: 'ann-2',
          bookId: 84,
          bookTitle: 'Frankenstein',
          bookAuthor: 'Mary Shelley',
          chapterIndex: 1,
          chapterPage: 2,
          selectedText: 'Beware; for I am fearless, and therefore powerful.',
          color: 'rose',
          createdAt: '2026-09-03T15:05:00Z',
          updatedAt: '2026-09-03T15:05:00Z',
        },
      ],
      preferences: {
        theme: 'dark',
        stickyScrollEnabled: false,
        speech: {
          rate: 1.25,
          voiceURI: 'en-GB-Natural',
          autoPageAdvance: false,
          highlightEnabled: true,
        },
      },
    };

    it('merges incoming backup non-destructively by default', async () => {
      const summary = await restoreLibraryBackup(incomingBackup, 'merge');

      const bookshelfState = useBookshelfStore.getState();
      const readerState = useReaderStore.getState();
      const annotationState = useAnnotationStore.getState();
      const themeState = useThemeStore.getState();
      const prefsState = usePreferencesStore.getState();

      // Books should contain both 1342 and 84
      expect(bookshelfState.savedBooks).toHaveLength(2);
      expect(bookshelfState.savedBooks.map((b) => b.id).sort((a, b) => a - b)).toEqual([84, 1342]);

      // Favorites should contain both
      expect(bookshelfState.likedBookIds.sort((a, b) => a - b)).toEqual([84, 1342]);

      // Ratings & reading statuses should be merged
      expect(bookshelfState.bookRatings).toEqual({ 1342: 5, 84: 4 });
      expect(bookshelfState.bookStatuses).toEqual({ 1342: 'finished', 84: 'currently_reading' });

      // Custom shelves should contain Classics and Sci-Fi
      expect(bookshelfState.cloudBookshelves).toHaveLength(2);
      expect(bookshelfState.cloudBookshelves.map((s) => s.name).sort()).toEqual(['Classics', 'Sci-Fi']);

      // Reading progress for 1342 should be upgraded to 50%
      expect(readerState.readingProgress[1342]).toBe(50);
      expect(readerState.readingProgress[84]).toBe(20);

      // Reading position for 1342 should be upgraded because backup was newer
      expect(readerState.readingPositions[1342].chapterIndex).toBe(3);
      expect(readerState.readingPositions[84].chapterIndex).toBe(1);

      // Annotations should contain both ann-1 and ann-2
      expect(annotationState.annotations).toHaveLength(2);

      // Preferences should be updated
      expect(themeState.theme).toBe('dark');
      expect(prefsState.stickyScrollEnabled).toBe(false);
      expect(prefsState.speechRate).toBe(1.25);

      expect(summary.booksRestored).toBe(2);
      expect(summary.annotationsRestored).toBe(2);
    });

    it('overwrites state completely when replace strategy is selected', async () => {
      // Set an initial book that is NOT in incomingBackup
      useReaderStore.setState({
        readingProgress: { 999: 80 },
      });

      const summary = await restoreLibraryBackup(incomingBackup, 'replace');

      const bookshelfState = useBookshelfStore.getState();
      const readerState = useReaderStore.getState();
      const annotationState = useAnnotationStore.getState();

      // Books should only contain 84 (1342 wiped)
      expect(bookshelfState.savedBooks).toHaveLength(1);
      expect(bookshelfState.savedBooks[0].id).toBe(84);

      // Favorites should only contain 84
      expect(bookshelfState.likedBookIds).toEqual([84]);

      // Ratings & reading statuses should only contain incoming backup
      expect(bookshelfState.bookRatings).toEqual({ 84: 4 });
      expect(bookshelfState.bookStatuses).toEqual({ 84: 'currently_reading' });

      // Annotations should only contain ann-2
      expect(annotationState.annotations).toHaveLength(1);
      expect(annotationState.annotations[0].id).toBe('ann-2');

      // Progress should only contain what was in incomingBackup
      expect(readerState.readingProgress[84]).toBe(20);
      expect(readerState.readingProgress[999]).toBeUndefined();

      expect(summary.booksRestored).toBe(1);
    });

    it('triggers cloud sync if userId is provided', async () => {
      const syncWithCloudMock = vi.fn().mockResolvedValue(undefined);
      useBookshelfStore.setState({ syncWithCloud: syncWithCloudMock });
      useAnnotationStore.setState({ syncWithCloud: syncWithCloudMock });

      await restoreLibraryBackup(incomingBackup, 'merge', 'auth-user-999');

      expect(syncWithCloudMock).toHaveBeenCalledWith('auth-user-999');
    });

    it('restores readingQueue correctly in replace mode', async () => {
      useBookshelfStore.setState({
        readingQueue: [{ id: 999, title: 'Old Queue Book', authors: [], formats: {} } as any],
      });

      const backupWithQueue = {
        ...incomingBackup,
        library: {
          ...incomingBackup.library,
          readingQueue: [{ id: 84, title: 'Frankenstein', authors: [], formats: {} } as any],
        },
      };

      await restoreLibraryBackup(backupWithQueue, 'replace');

      const queue = useBookshelfStore.getState().readingQueue;
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe(84);
    });
  });

  describe('Security & Deserialization Defense Suite', () => {
    it('rejects payloads containing prototype pollution keys', () => {
      const maliciousPayload = {
        version: '1.0',
        app: 'Bookarium',
        library: {
          savedBooks: [{ id: 1, title: 'Safe Book' }],
          bookRatings: JSON.parse('{"__proto__": {"admin": true}}'),
        },
      };

      const result = validateLibraryBackup(maliciousPayload);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/prototype/i);
    });

    it('validates all items in large savedBooks arrays beyond index 50', () => {
      const books = Array.from({ length: 60 }, (_, i) => ({
        id: i + 1,
        title: `Book ${i + 1}`,
        authors: [{ name: 'Author' }],
        formats: {},
      }));

      // Inject invalid book at index 55 (previously unreached due to Math.min 50)
      books[55] = { id: 'invalid-id' as any, title: 'Corrupted Book' } as any;

      const payload = {
        version: '1.0',
        app: 'Bookarium',
        library: {
          savedBooks: books,
        },
      };

      const result = validateLibraryBackup(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/index 55/i);
    });

    it('rejects malformed customShelves missing bookIds array', () => {
      const payload = {
        version: '1.0',
        app: 'Bookarium',
        library: {
          savedBooks: [{ id: 1, title: 'Dracula' }],
          customShelves: [
            { name: 'Malformed Shelf' }, // Missing bookIds
          ],
        },
      };

      const result = validateLibraryBackup(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/custom shelf at index 0/i);
    });

    it('filters out-of-bounds ratings and non-standard statuses', () => {
      const payload = {
        version: '1.0',
        app: 'Bookarium',
        library: {
          savedBooks: [{ id: 1, title: 'Frankenstein' }],
          bookRatings: { 1: 10, 2: -5, 3: 4 },
          bookStatuses: { 1: 'super_finished', 3: 'finished' },
        },
      };

      const result = validateLibraryBackup(payload);
      expect(result.valid).toBe(true);
      expect(result.data?.library.bookRatings).toEqual({ 3: 4 });
      expect(result.data?.library.bookStatuses).toEqual({ 3: 'finished' });
    });
  });
});

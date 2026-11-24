import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HighlightBioPickerModal,
  formatHighlightForScholarBio,
  resolveHighlightBookAttribution,
} from './HighlightBioPickerModal';
import { useAnnotationStore, type Annotation } from '@/stores/useAnnotationStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { SCHOLAR_BIO_MAX_LENGTH } from '@/config/site-config';
import type { GutendexBook } from '@/types/book.types';

let mockOfflineBooksList: GutendexBook[] = [];
vi.mock('@/hooks/useOfflineBooks', () => ({
  useOfflineBooks: () => ({
    offlineBooks: mockOfflineBooksList,
    offlineBookIds: mockOfflineBooksList.map((b) => b.id),
    isBookOffline: (id: number) => mockOfflineBooksList.some((b) => b.id === id),
  }),
}));

const sampleAnnotations: Annotation[] = [
  {
    id: 'ann-1',
    bookId: 1342,
    bookTitle: 'The Project Gutenberg eBook of Pride and Prejudice',
    bookAuthor: 'Austen, Jane',
    chapterIndex: 0,
    chapterPage: 0,
    selectedText:
      'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
    color: 'yellow',
    note: 'Opening irony motif for Regency satire',
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'ann-2',
    bookId: 84,
    bookTitle: 'Unknown Volume',
    bookAuthor: 'Anonymous',
    chapterIndex: 2,
    chapterPage: 4,
    selectedText: 'Beware; for I am fearless, and therefore powerful.',
    color: 'mint',
    note: 'Creature monologue climax',
    createdAt: '2026-02-15T12:00:00Z',
    updatedAt: '2026-02-15T12:00:00Z',
  },
];

describe('HighlightBioPickerModal & pure helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOfflineBooksList = [];
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true, writable: true });
    act(() => {
      useAuthStore.setState({ user: null, profile: null });
      useAnnotationStore.setState({ annotations: [], syncWithCloud: vi.fn().mockResolvedValue(undefined) });
      useBookshelfStore.setState({
        savedBooks: [],
        favoriteBooks: [],
        recentBooks: [],
      });
    });
  });

  it('normalizes whitespace and truncates highlights cleanly at word boundaries', () => {
    expect(formatHighlightForScholarBio('  Hello\n  world   of books  ')).toBe(
      'Hello world of books'
    );
    expect(formatHighlightForScholarBio('')).toBe('');
    expect(formatHighlightForScholarBio('Hello', 1)).toBe('…');

    const longSentence =
      'Reading classical literature opens a quiet sanctuary across centuries of human thought '.repeat(
        8
      );
    const formatted = formatHighlightForScholarBio(longSentence, SCHOLAR_BIO_MAX_LENGTH);
    expect(formatted.length).toBeLessThanOrEqual(SCHOLAR_BIO_MAX_LENGTH);
    expect(formatted.endsWith('…')).toBe(true);
    expect(formatted).not.toMatch(/\s…$/);
  });

  it('resolves non-placeholder book titles and authors without falling back to Anonymous', () => {
    const resolvedFromBookshelf = resolveHighlightBookAttribution(
      { bookId: 99999, bookTitle: 'Unknown Volume', bookAuthor: 'Anonymous' },
      {
        savedBooks: [
          {
            id: 99999,
            title: 'The Project Gutenberg EBook of Middlemarch',
            authors: [{ name: 'Eliot, George' }],
            translators: [],
            subjects: [],
            bookshelves: [],
            languages: ['en'],
            copyright: false,
            media_type: 'Text',
            formats: {},
            download_count: 1000,
          },
        ],
      }
    );
    expect(resolvedFromBookshelf).toEqual({
      bookId: 99999,
      title: 'Middlemarch',
      author: 'George Eliot',
    });

    const unknownFallback = resolveHighlightBookAttribution(
      { bookId: 777777, bookTitle: '', bookAuthor: 'Anonymous' },
      {}
    );
    expect(unknownFallback).toEqual({
      bookId: 777777,
      title: 'Volume #777777',
      author: null,
    });
  });

  it('renders empty state and passively syncs annotations online when local list is empty', async () => {
    const syncWithCloudMock = vi.fn().mockResolvedValue(undefined);
    act(() => {
      useAuthStore.setState({
        user: { id: 'scholar-sync-1' } as unknown as ReturnType<typeof useAuthStore.getState>['user'],
      });
      useAnnotationStore.setState({
        annotations: [],
        syncWithCloud: syncWithCloudMock,
      });
    });

    render(
      <HighlightBioPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectHighlight={vi.fn()}
      />
    );

    expect(screen.getByTestId('highlight-picker-empty')).toHaveTextContent(
      /no saved highlights yet/i
    );
    await waitFor(() => {
      expect(syncWithCloudMock).toHaveBeenCalledWith('scholar-sync-1', {
        minSyncIntervalMs: 15_000,
      });
    });
  });

  it('searches highlights via multi-token matching, filters no-match queries, and emits clean selection payload', () => {
    const onSelectHighlight = vi.fn();
    const onClose = vi.fn();
    const longText = `${'All happy families are alike; '.repeat(16)}end.`;

    act(() => {
      useAnnotationStore.setState({
        annotations: [
          ...sampleAnnotations,
          {
            id: 'ann-long',
            bookId: 1399,
            bookTitle: 'Anna Karenina',
            bookAuthor: 'Leo Tolstoy',
            chapterIndex: 0,
            chapterPage: 0,
            selectedText: longText,
            color: 'rose',
            createdAt: '2026-03-01T10:00:00Z',
            updatedAt: '2026-03-01T10:00:00Z',
          },
        ],
      });
    });

    render(
      <HighlightBioPickerModal
        isOpen={true}
        onClose={onClose}
        currentBio="Beware; for I am fearless, and therefore powerful."
        currentBookId={84}
        onSelectHighlight={onSelectHighlight}
      />
    );

    // Count indicator & active selection state & truncation pill
    expect(screen.getByText(/showing 3 of 3 highlights/i)).toBeInTheDocument();
    expect(screen.getByText(`Trimmed to ${SCHOLAR_BIO_MAX_LENGTH} chars`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^selected$/i })).toBeInTheDocument();

    // Multi-token NFD order-independent search (even matching private note without leaking it)
    const searchInput = screen.getByRole('textbox', { name: /search saved highlights/i });
    fireEvent.change(searchInput, { target: { value: 'satire irony austen' } });

    expect(screen.getByText(/showing 1 of 3 highlights/i)).toBeInTheDocument();
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();

    // Zero match state + Clear Search button
    fireEvent.change(searchInput, { target: { value: 'nonexistentxyzphrase' } });
    expect(screen.getByTestId('highlight-picker-no-matches')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));
    expect(screen.getByText(/showing 3 of 3 highlights/i)).toBeInTheDocument();

    // Select Frankenstein (#84, featured-books enrichment resolves title/author)
    fireEvent.change(searchInput, { target: { value: 'fearless' } });
    expect(screen.getByText(/Frankenstein/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^selected$/i }));

    expect(onSelectHighlight).toHaveBeenCalledWith({
      bio: 'Beware; for I am fearless, and therefore powerful.',
      bookId: 84,
      bookTitle: expect.stringContaining('Frankenstein'),
      bookAuthor: 'Mary Wollstonecraft Shelley',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

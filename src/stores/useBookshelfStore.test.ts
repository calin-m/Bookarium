import { describe, it, expect, beforeEach } from 'vitest';
import { useBookshelfStore } from './useBookshelfStore';
import { mockBooks } from '@/mocks/handlers';

describe('useBookshelfStore', () => {
  beforeEach(() => {
    useBookshelfStore.getState().clearBookshelf();
  });

  it('should initialize with empty collections', () => {
    const state = useBookshelfStore.getState();
    expect(state.savedBooks).toEqual([]);
    expect(state.readingQueue).toEqual([]);
    expect(state.likedBookIds).toEqual([]);
    expect(state.recentBooks).toEqual([]);
  });

  it('should toggle save book in bookshelf', () => {
    const book = mockBooks[0];
    const store = useBookshelfStore.getState();

    expect(store.isBookSaved(book.id)).toBe(false);

    store.toggleSaveBook(book);
    expect(useBookshelfStore.getState().savedBooks).toHaveLength(1);
    expect(useBookshelfStore.getState().isBookSaved(book.id)).toBe(true);

    useBookshelfStore.getState().toggleSaveBook(book);
    expect(useBookshelfStore.getState().savedBooks).toHaveLength(0);
    expect(useBookshelfStore.getState().isBookSaved(book.id)).toBe(false);
  });

  it('should manage reading queue', () => {
    const book1 = mockBooks[0];
    const book2 = mockBooks[1];

    useBookshelfStore.getState().addToQueue(book1);
    useBookshelfStore.getState().addToQueue(book2);
    // duplicate addition should be ignored
    useBookshelfStore.getState().addToQueue(book1);

    expect(useBookshelfStore.getState().readingQueue).toHaveLength(2);
    expect(useBookshelfStore.getState().isInQueue(book1.id)).toBe(true);

    useBookshelfStore.getState().removeFromQueue(book1.id);
    expect(useBookshelfStore.getState().readingQueue).toHaveLength(1);
    expect(useBookshelfStore.getState().isInQueue(book1.id)).toBe(false);
  });

  it('should toggle like status', () => {
    const bookId = 1342;
    expect(useBookshelfStore.getState().isBookLiked(bookId)).toBe(false);

    useBookshelfStore.getState().toggleLikeBook(bookId);
    expect(useBookshelfStore.getState().isBookLiked(bookId)).toBe(true);

    useBookshelfStore.getState().toggleLikeBook(bookId);
    expect(useBookshelfStore.getState().isBookLiked(bookId)).toBe(false);
  });

  it('should track recent books up to 20 items without duplicates', () => {
    const book = mockBooks[0];
    useBookshelfStore.getState().addRecentBook(book);
    expect(useBookshelfStore.getState().recentBooks).toHaveLength(1);

    // Re-adding pushes it to top
    useBookshelfStore.getState().addRecentBook(book);
    expect(useBookshelfStore.getState().recentBooks).toHaveLength(1);
  });
});


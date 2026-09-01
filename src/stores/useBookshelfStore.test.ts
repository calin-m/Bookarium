import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBookshelfStore, useHydratedBookshelf } from './useBookshelfStore';
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

  it('should toggle like status and store likedBooks', () => {
    const book = mockBooks[0];
    expect(useBookshelfStore.getState().isBookLiked(book.id)).toBe(false);

    useBookshelfStore.getState().toggleLikeBook(book);
    expect(useBookshelfStore.getState().isBookLiked(book.id)).toBe(true);
    expect(useBookshelfStore.getState().likedBooks).toHaveLength(1);
    expect(useBookshelfStore.getState().likedBooks[0].id).toBe(book.id);

    useBookshelfStore.getState().toggleLikeBook(book);
    expect(useBookshelfStore.getState().isBookLiked(book.id)).toBe(false);
    expect(useBookshelfStore.getState().likedBooks).toHaveLength(0);

    // Also support ID-based toggle for backward compatibility
    useBookshelfStore.getState().toggleLikeBook(book.id);
    expect(useBookshelfStore.getState().isBookLiked(book.id)).toBe(true);
    useBookshelfStore.getState().toggleLikeBook(book.id);
    expect(useBookshelfStore.getState().isBookLiked(book.id)).toBe(false);
  });

  it('should sync and clear liked books', () => {
    const book = mockBooks[0];
    useBookshelfStore.setState({ likedBookIds: [book.id], likedBooks: [] });

    useBookshelfStore.getState().syncLikedBooks([book]);
    expect(useBookshelfStore.getState().likedBooks).toHaveLength(1);
    expect(useBookshelfStore.getState().likedBooks[0].id).toBe(book.id);

    useBookshelfStore.getState().clearLikedBooks();
    expect(useBookshelfStore.getState().likedBooks).toHaveLength(0);
    expect(useBookshelfStore.getState().likedBookIds).toHaveLength(0);
  });

  describe('useHydratedBookshelf', () => {
    it('returns live hydrated state and reactive actions', () => {
      const book = mockBooks[0];
      const { result } = renderHook(() => useHydratedBookshelf());

      expect(result.current.hasMounted).toBe(true);
      expect(result.current.isSaved(book.id)).toBe(false);
      expect(result.current.isLiked(book.id)).toBe(false);
      expect(result.current.savedCount).toBe(0);

      act(() => {
        result.current.toggleSaveBook(book);
        result.current.toggleLikeBook(book);
      });

      expect(result.current.isSaved(book.id)).toBe(true);
      expect(result.current.isLiked(book.id)).toBe(true);
      expect(result.current.savedCount).toBe(1);
      expect(result.current.likedCount).toBe(1);

      act(() => {
        result.current.addToQueue(book);
      });
      expect(result.current.queueCount).toBe(1);
      expect(result.current.readingQueue).toHaveLength(1);

      act(() => {
        result.current.removeFromQueue(book.id);
      });
      expect(result.current.queueCount).toBe(0);

      act(() => {
        result.current.clearBookshelf();
      });
      expect(result.current.savedCount).toBe(0);
      expect(result.current.likedCount).toBe(0);
    });
  });
});


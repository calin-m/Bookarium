import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotebookMetadataResolver } from './useNotebookMetadataResolver';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useJurisdictionStore } from '@/stores/useJurisdictionStore';
import type { Annotation } from '@/stores/useAnnotationStore';

vi.mock('@/hooks/queries/useBooks', () => ({
  useBooks: vi.fn(() => ({ data: undefined })),
}));

vi.mock('@/hooks/useOfflineBooks', () => ({
  useOfflineBooks: vi.fn(() => ({
    isBookOffline: () => false,
    offlineBooks: [],
  })),
}));

vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn(() => ({
    isOnline: true,
    isOffline: false,
  })),
}));

describe('useNotebookMetadataResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBookshelfStore.getState().clearBookshelf();
    useJurisdictionStore.getState().setCountry('US');
  });

  it('resolves book title, author, and jurisdiction restriction from annotation and featured fixtures, and primes reader store', () => {
    const sampleAnnotation: Annotation = {
      id: 'ann-1',
      bookId: 1342,
      bookTitle: 'Gutenberg Volume #1342',
      bookAuthor: 'Anonymous',
      chapterIndex: 0,
      chapterPage: 0,
      selectedText: 'It is a truth universally acknowledged.',
      note: 'Opening line',
      color: 'yellow',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { result } = renderHook(() =>
      useNotebookMetadataResolver([sampleAnnotation], [], undefined)
    );

    const details = result.current.resolveBookDetails(sampleAnnotation);
    expect(details.title).toBe('Pride and Prejudice');
    expect(details.author).toContain('Jane Austen');
    expect(details.isRestricted).toBe(false);

    const openReaderSpy = vi.spyOn(useReaderStore.getState(), 'openReader');
    act(() => {
      result.current.primeReaderForBook(1342);
    });
    expect(openReaderSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 1342 }));
  });
});

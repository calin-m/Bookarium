import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotebookMetadataResolver } from './useNotebookMetadataResolver';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useJurisdictionStore } from '@/stores/useJurisdictionStore';
import { useAnnotationStore, type Annotation } from '@/stores/useAnnotationStore';
import { useFellowshipStore } from '@/stores/useFellowshipStore';
import { useBooks } from '@/hooks/queries/useBooks';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { GutendexBook } from '@/types/book.types';

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
    vi.mocked(useBooks).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useBooks>);
    vi.mocked(useOfflineBooks).mockReturnValue({
      isBookOffline: () => false,
      offlineBooks: [],
      isLoading: false,
      downloadBook: vi.fn(),
      removeOfflineBook: vi.fn(),
      refreshOfflineBooks: vi.fn(),
    } as unknown as ReturnType<typeof useOfflineBooks>);
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOnline: true,
      isOffline: false,
    });
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

  it('resolves metadata from savedBooks/offlineBooks pools and enforces LIFE_70 copyright restriction in GB', () => {
    const christieBook: GutendexBook = {
      id: 863,
      title: 'The Mysterious Affair at Styles',
      authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
      translators: [],
      subjects: ['Detective fiction'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 4200,
    };
    useBookshelfStore.setState({ savedBooks: [christieBook] });
    useJurisdictionStore.getState().setCountry('GB');

    const ann: Annotation = {
      id: 'ann-863',
      bookId: 863,
      bookTitle: 'Gutenberg Volume #863',
      bookAuthor: 'Anonymous',
      chapterIndex: 0,
      chapterPage: 0,
      selectedText: 'Poirot examined the footprints.',
      color: 'amber',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { result } = renderHook(() => useNotebookMetadataResolver([ann], [], undefined));
    const details = result.current.resolveBookDetails(ann);
    expect(details.title).toBe('The Mysterious Affair at Styles');
    expect(details.author).toContain('Agatha Christie');
    expect(details.country).toBe('GB');
    expect(details.isRestricted).toBe(true);

    const openReaderSpy = vi.spyOn(useReaderStore.getState(), 'openReader');
    act(() => {
      result.current.primeReaderForBook(863);
    });
    expect(openReaderSpy).toHaveBeenCalledWith(christieBook);
  });

  it('queries remote useBooks for unindexed volume IDs, auto-heals local stores, and hydrates Fellow Scholar profiles when online', async () => {
    const remoteBook: GutendexBook = {
      id: 9999,
      title: 'The Odyssey',
      authors: [{ name: 'Homer', birth_year: -800, death_year: -701 }],
      translators: [],
      subjects: ['Epic poetry'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 9500,
    };

    vi.mocked(useBooks).mockReturnValue({
      data: { count: 1, next: null, previous: null, results: [remoteBook] },
    } as unknown as ReturnType<typeof useBooks>);

    const enrichSavedSpy = vi.spyOn(useBookshelfStore.getState(), 'enrichSavedBooks');
    const enrichPositionsSpy = vi.spyOn(useReaderStore.getState(), 'enrichReadingPositions');
    const updateMetadataSpy = vi.spyOn(useAnnotationStore.getState(), 'updateBookMetadata');
    const fetchFellowshipSpy = vi
      .spyOn(useFellowshipStore.getState(), 'fetchFellowshipData')
      .mockResolvedValue(undefined);
    const syncCloudSpy = vi
      .spyOn(useAnnotationStore.getState(), 'syncWithCloud')
      .mockResolvedValue(undefined);
    const enrichFellowSpy = vi.spyOn(useAnnotationStore.getState(), 'enrichFellowAnnotations');
    const resolveStaleSpy = vi
      .spyOn(useAnnotationStore.getState(), 'resolveStaleFellowProfiles')
      .mockResolvedValue(undefined);

    const unindexedAnn: Annotation = {
      id: 'ann-9999',
      bookId: 9999,
      bookTitle: 'Gutenberg Volume #9999',
      bookAuthor: 'Unknown Author',
      chapterIndex: 1,
      chapterPage: 0,
      selectedText: 'Sing in me, Muse.',
      color: 'mint',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { result } = renderHook(() =>
      useNotebookMetadataResolver([unindexedAnn], [], 'user-scholar-1')
    );

    expect(useBooks).toHaveBeenCalledWith(
      {
        ids: '9999',
        page: 1,
        copyright: false,
        includeRestrictedMetadata: true,
      },
      { enabled: true }
    );

    await waitFor(() => {
      expect(enrichSavedSpy).toHaveBeenCalledWith([remoteBook]);
      expect(enrichPositionsSpy).toHaveBeenCalledWith([remoteBook]);
      expect(updateMetadataSpy).toHaveBeenCalledWith(9999, 'The Odyssey', 'Homer');
      expect(fetchFellowshipSpy).toHaveBeenCalledWith('user-scholar-1');
      expect(syncCloudSpy).toHaveBeenCalledWith('user-scholar-1');
      expect(enrichFellowSpy).toHaveBeenCalled();
      expect(resolveStaleSpy).toHaveBeenCalled();
    });

    const details = result.current.resolveBookDetails(unindexedAnn);
    expect(details.title).toBe('The Odyssey');
    expect(details.author).toBe('Homer');
  });
});

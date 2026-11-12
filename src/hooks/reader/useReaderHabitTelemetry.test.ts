import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReaderHabitTelemetry } from './useReaderHabitTelemetry';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';

describe('useReaderHabitTelemetry', () => {
  beforeEach(() => {
    useBookshelfStore.getState().clearBookshelf();
    useReaderStore.setState({
      currentBook: null,
      readingProgress: {},
      readingPositions: {},
    });
  });

  it('transitions reading status to currently_reading on start and finished at end, and derives symposium companion milestones', () => {
    const setReadingStatus = vi.fn();
    const syncSymposiumProgress = vi.fn();
    const updateBookMetadata = vi.fn();
    const refetch = vi.fn();

    const { result, rerender } = renderHook(
      (props: { isAtEnd: boolean; readingStatus: 'want_to_read' | 'currently_reading' | 'finished' | null }) =>
        useReaderHabitTelemetry({
          numericId: 1342,
          userId: 'user-host',
          isContentLoading: false,
          isContentError: false,
          contentText: 'Sample book content',
          isPlayingTTS: false,
          isAtEnd: props.isAtEnd,
          readingStatus: props.readingStatus,
          setReadingStatus,
          symposiums: [
            {
              id: 'symp-1',
              host_id: 'user-host',
              host_username: 'host_scholar',
              host_display_name: 'Dr. Host',
              fellow_id: 'user-fellow',
              fellow_username: 'fellow_scholar',
              fellow_display_name: 'Dr. Fellow',
              book_id: 1342,
              book_title: 'Pride and Prejudice',
              status: 'active',
              host_chapter: 1,
              host_progress: 20,
              fellow_chapter: 2,
              fellow_progress: 50,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          activeChapterIndex: 1,
          volumeProgress: 30,
          syncSymposiumProgress,
          resolvedIdentity: {
            id: 1342,
            title: 'Pride and Prejudice',
            author: 'Jane Austen',
            displayAuthor: 'Jane Austen',
            authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
            translators: [],
            primarySubject: 'Fiction',
            languages: ['en'],
            isPublicDomain: true,
          },
          refetch,
          updateBookMetadata,
        }),
      {
        initialProps: { isAtEnd: false, readingStatus: 'want_to_read' },
      }
    );

    expect(updateBookMetadata).toHaveBeenCalledWith(1342, 'Pride and Prejudice', 'Jane Austen');
    expect(setReadingStatus).toHaveBeenCalledWith(1342, 'currently_reading', 'user-host');
    expect(syncSymposiumProgress).toHaveBeenCalledWith(1342, 1, 30);
    expect(result.current.symposiumCompanion).toEqual({
      username: 'fellow_scholar',
      displayName: 'Dr. Fellow',
      progress: 50,
      currentChapterIndex: 2,
    });
    expect(result.current.symposiumMilestoneNotice?.progress).toBe(50);

    act(() => {
      result.current.dismissSymposiumMilestone();
    });
    expect(result.current.symposiumMilestoneNotice).toBeNull();

    rerender({ isAtEnd: true, readingStatus: 'currently_reading' });
    expect(setReadingStatus).toHaveBeenCalledWith(1342, 'finished', 'user-host');
    expect(result.current.isCompletionModalOpen).toBe(true);

    act(() => {
      result.current.dismissCompletionModal();
    });
    expect(result.current.isCompletionModalOpen).toBe(false);
  });

  it('enriches stores from booksData, auto-retries refetch once on content error when lifespans arrive, updates document.title, and derives fellow-side symposium progress', () => {
    const addRecentSpy = vi.spyOn(useBookshelfStore.getState(), 'addRecentBook');
    const enrichSavedSpy = vi.spyOn(useBookshelfStore.getState(), 'enrichSavedBooks');
    const openReaderSpy = vi.spyOn(useReaderStore.getState(), 'openReader');
    const enrichPositionsSpy = vi.spyOn(useReaderStore.getState(), 'enrichReadingPositions');
    const refetch = vi.fn();

    const apiBook = {
      id: 84,
      title: 'Frankenstein; Or, The Modern Prometheus',
      authors: [{ name: 'Shelley, Mary Wollstonecraft', birth_year: 1797, death_year: 1851 }],
      translators: [],
      subjects: ['Science fiction'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 18000,
    };

    const { result, rerender } = renderHook(() =>
      useReaderHabitTelemetry({
        numericId: 84,
        userId: 'user-fellow',
        isContentLoading: false,
        isContentError: true,
        contentText: undefined,
        isPlayingTTS: false,
        isAtEnd: false,
        readingStatus: 'currently_reading',
        setReadingStatus: vi.fn(),
        symposiums: [
          {
            id: 'symp-84',
            host_id: 'user-host',
            host_username: 'byron',
            host_display_name: 'Lord Byron',
            fellow_id: 'user-fellow',
            fellow_username: 'mary_s',
            fellow_display_name: 'Mary Shelley',
            book_id: 84,
            book_title: 'Frankenstein',
            status: 'active',
            host_chapter: 4,
            host_progress: 65,
            fellow_chapter: 2,
            fellow_progress: 30,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        activeChapterIndex: 2,
        volumeProgress: 30,
        syncSymposiumProgress: vi.fn(),
        booksData: {
          count: 1,
          next: null,
          previous: null,
          results: [apiBook],
        },
        resolvedIdentity: {
          id: 84,
          title: 'Frankenstein',
          author: 'Mary Shelley',
          displayAuthor: 'Mary Shelley',
          authors: apiBook.authors,
          translators: [],
          primarySubject: 'Science fiction',
          languages: ['en'],
          isPublicDomain: true,
        },
        refetch,
        updateBookMetadata: vi.fn(),
      })
    );

    expect(document.title).toBe('Bookarium | Reader | Frankenstein — Mary Shelley');
    expect(addRecentSpy).toHaveBeenCalledWith(apiBook);
    expect(openReaderSpy).toHaveBeenCalledWith(apiBook);
    expect(enrichSavedSpy).toHaveBeenCalledWith([apiBook]);
    expect(enrichPositionsSpy).toHaveBeenCalledWith([apiBook]);
    expect(refetch).toHaveBeenCalledTimes(1);

    // Re-rendering with same numericId should not trigger an infinite auto-retry loop
    rerender();
    expect(refetch).toHaveBeenCalledTimes(1);

    // Fellow-side companion telemetry reflects the host's progress and chapter
    expect(result.current.symposiumCompanion).toEqual({
      username: 'byron',
      displayName: 'Lord Byron',
      progress: 65,
      currentChapterIndex: 4,
    });
  });

  it('gates currently_reading auto-transition to active engagement (page >= 3, chapter > 0, bookmark placed)', () => {
    const setReadingStatus = vi.fn();
    const baseParams = {
      numericId: 1342,
      userId: 'user-1',
      isContentLoading: false,
      isContentError: false,
      contentText: 'Pride and Prejudice opening text',
      isPlayingTTS: false,
      isAtEnd: false,
      readingStatus: null,
      setReadingStatus,
      symposiums: [],
      activeChapterIndex: 0,
      currentChapterPage: 1,
      currentGlobalPage: 1,
      bookmarkRow: 0,
      volumeProgress: 0,
      syncSymposiumProgress: vi.fn(),
      resolvedIdentity: {
        id: 1342,
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        displayAuthor: 'Jane Austen',
        authors: [{ name: 'Jane Austen', birth_year: 1775, death_year: 1817 }],
        translators: [],
        primarySubject: 'Fiction',
        languages: ['en'],
        isPublicDomain: true,
      },
      refetch: vi.fn(),
      updateBookMetadata: vi.fn(),
    };

    // 1. Initial render on Chapter 0, Page 1: should NOT call setReadingStatus
    const { rerender } = renderHook((props: typeof baseParams) => useReaderHabitTelemetry(props), {
      initialProps: baseParams,
    });
    expect(setReadingStatus).not.toHaveBeenCalledWith(1342, 'currently_reading', 'user-1');

    // 2. Turning to Page 2: still below page 3 threshold: should NOT call setReadingStatus
    rerender({
      ...baseParams,
      currentChapterPage: 2,
      currentGlobalPage: 2,
    });
    expect(setReadingStatus).not.toHaveBeenCalledWith(1342, 'currently_reading', 'user-1');

    // 3. Advancing to Page 3: reaches threshold: SHOULD call setReadingStatus
    rerender({
      ...baseParams,
      currentChapterPage: 3,
      currentGlobalPage: 3,
    });
    expect(setReadingStatus).toHaveBeenCalledWith(1342, 'currently_reading', 'user-1');

    // 4. Resetting and setting a line bookmark even on Page 1 should activate currently_reading
    setReadingStatus.mockClear();
    renderHook(() =>
      useReaderHabitTelemetry({
        ...baseParams,
        currentChapterPage: 1,
        currentGlobalPage: 1,
        bookmarkRow: 4,
        bookmarkText: 'It is a truth universally acknowledged',
      })
    );
    expect(setReadingStatus).toHaveBeenCalledWith(1342, 'currently_reading', 'user-1');
  });
});

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
});

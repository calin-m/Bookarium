import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useReaderExitBookmark,
  hasBookmarkAhead,
  shouldInterceptExit,
} from './useReaderExitBookmark';
import { useReaderStore } from '@/stores/useReaderStore';

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

describe('useReaderExitBookmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'history', {
      configurable: true,
      writable: true,
      value: { length: 3 },
    });
    useReaderStore.setState({
      readingPositions: {},
      readingProgress: {},
    });
  });

  describe('hasBookmarkAhead (pure helper)', () => {
    it('returns false when existingPos is null, undefined, or lacks a placed bookmark', () => {
      expect(
        hasBookmarkAhead({
          existingPos: null,
          activeChapterIndex: 0,
          currentChapterPage: 1,
        })
      ).toBe(false);

      expect(
        hasBookmarkAhead({
          existingPos: undefined,
          activeChapterIndex: 0,
          currentChapterPage: 1,
        })
      ).toBe(false);

      expect(
        hasBookmarkAhead({
          existingPos: {
            chapterIndex: 2,
            chapterPage: 5,
            globalPage: 15,
            bookmarkRow: 0,
            lastReadAt: new Date().toISOString(),
          },
          activeChapterIndex: 0,
          currentChapterPage: 1,
        })
      ).toBe(false);
    });

    it('returns true when a placed bookmark exists in a later chapter', () => {
      expect(
        hasBookmarkAhead({
          existingPos: {
            chapterIndex: 2,
            chapterPage: 1,
            globalPage: 10,
            bookmarkRow: 4,
            lastReadAt: new Date().toISOString(),
          },
          activeChapterIndex: 1,
          currentChapterPage: 8,
        })
      ).toBe(true);
    });

    it('returns true when a placed bookmark exists on a later page within the same chapter', () => {
      expect(
        hasBookmarkAhead({
          existingPos: {
            chapterIndex: 1,
            chapterPage: 7,
            globalPage: 14,
            bookmarkText: 'Specific bookmarked line',
            lastReadAt: new Date().toISOString(),
          },
          activeChapterIndex: 1,
          currentChapterPage: 3,
        })
      ).toBe(true);
    });

    it('returns false when a placed bookmark is on the current page or an earlier page', () => {
      // Same page
      expect(
        hasBookmarkAhead({
          existingPos: {
            chapterIndex: 1,
            chapterPage: 3,
            globalPage: 10,
            bookmarkRow: 2,
            lastReadAt: new Date().toISOString(),
          },
          activeChapterIndex: 1,
          currentChapterPage: 3,
        })
      ).toBe(false);

      // Earlier page in same chapter
      expect(
        hasBookmarkAhead({
          existingPos: {
            chapterIndex: 1,
            chapterPage: 1,
            globalPage: 8,
            bookmarkRow: 2,
            lastReadAt: new Date().toISOString(),
          },
          activeChapterIndex: 1,
          currentChapterPage: 3,
        })
      ).toBe(false);

      // Earlier chapter
      expect(
        hasBookmarkAhead({
          existingPos: {
            chapterIndex: 0,
            chapterPage: 5,
            globalPage: 5,
            bookmarkRow: 2,
            lastReadAt: new Date().toISOString(),
          },
          activeChapterIndex: 1,
          currentChapterPage: 1,
        })
      ).toBe(false);
    });

    it('resolves cross-device reflowed page via bookmarkText and chaptersWithPagination before comparing coordinates', () => {
      const desktopChapters = [
        {
          id: 1,
          title: 'Chapter 1',
          displayTitle: 'Chapter 1',
          content: 'Page 1 text. Page 2 text. Target passage originally on mobile page 8.',
          pageCount: 3,
          startPageNumber: 1,
          pages: [
            'Page 1 text.',
            'Page 2 text.',
            'Target passage originally on mobile page 8.',
          ],
        },
      ];

      // Mobile saved chapterPage: 8, but on Desktop it reflows to Page 3.
      // When reader is on Desktop Page 4, the bookmark at Desktop Page 3 is BEHIND (not ahead)!
      expect(
        hasBookmarkAhead({
          existingPos: {
            chapterIndex: 0,
            chapterPage: 8,
            globalPage: 8,
            bookmarkRow: 4,
            bookmarkText: 'Target passage originally on mobile page 8.',
            lastReadAt: new Date().toISOString(),
          },
          activeChapterIndex: 0,
          currentChapterPage: 4,
          chaptersWithPagination: desktopChapters,
        })
      ).toBe(false);

      // When reader is on Desktop Page 2, the bookmark at Desktop Page 3 IS ahead!
      expect(
        hasBookmarkAhead({
          existingPos: {
            chapterIndex: 0,
            chapterPage: 8,
            globalPage: 8,
            bookmarkRow: 4,
            bookmarkText: 'Target passage originally on mobile page 8.',
            lastReadAt: new Date().toISOString(),
          },
          activeChapterIndex: 0,
          currentChapterPage: 2,
          chaptersWithPagination: desktopChapters,
        })
      ).toBe(true);

      // When bookmarkText is already on the stored chapterPage slice (Page 3), keeps Page 3
      expect(
        hasBookmarkAhead({
          existingPos: {
            chapterIndex: 0,
            chapterPage: 3,
            globalPage: 3,
            bookmarkRow: 4,
            bookmarkText: 'Target passage originally on mobile page 8.',
            lastReadAt: new Date().toISOString(),
          },
          activeChapterIndex: 0,
          currentChapterPage: 2,
          chaptersWithPagination: desktopChapters,
        })
      ).toBe(true);
    });
  });

  describe('shouldInterceptExit (pure helper)', () => {
    it('returns false when volume is finished', () => {
      expect(
        shouldInterceptExit({
          isFinished: true,
          exitBookmarkReminderEnabled: true,
          hasBookmarkOnThisPage: false,
          hasBookmarkAhead: false,
        })
      ).toBe(false);
    });

    it('returns false when exit bookmark reminder is disabled by user preference', () => {
      expect(
        shouldInterceptExit({
          isFinished: false,
          exitBookmarkReminderEnabled: false,
          hasBookmarkOnThisPage: false,
          hasBookmarkAhead: false,
        })
      ).toBe(false);
    });

    it('returns false when a line bookmark is already placed on the current page', () => {
      expect(
        shouldInterceptExit({
          isFinished: false,
          exitBookmarkReminderEnabled: true,
          hasBookmarkOnThisPage: true,
          hasBookmarkAhead: false,
        })
      ).toBe(false);
    });

    it('returns false when a placed bookmark exists further ahead in the volume', () => {
      expect(
        shouldInterceptExit({
          isFinished: false,
          exitBookmarkReminderEnabled: true,
          hasBookmarkOnThisPage: false,
          hasBookmarkAhead: true,
        })
      ).toBe(false);
    });

    it('returns true when all conditions pass and the user should be prompted', () => {
      expect(
        shouldInterceptExit({
          isFinished: false,
          exitBookmarkReminderEnabled: true,
          hasBookmarkOnThisPage: false,
          hasBookmarkAhead: false,
        })
      ).toBe(true);
    });
  });

  describe('useReaderExitBookmark hook lifecycle', () => {
    const defaultOptions = {
      numericId: 1342,
      activeChapterIndex: 0,
      currentChapterPage: 1,
      currentGlobalPage: 1,
      bookmarkRow: 0,
      bookmarkText: undefined,
      currentPageText: 'It is a truth universally acknowledged.\nSecond paragraph.',
      readingStatus: 'currently_reading',
      exitBookmarkReminderEnabled: true,
      userId: 'user-123',
      setReadingStatus: vi.fn(),
      setBookmarkRow: vi.fn(),
    };

    it('initializes with modal closed and evaluates isUnderThreshold correctly', () => {
      const { result, rerender } = renderHook(
        (props) => useReaderExitBookmark(props),
        { initialProps: defaultOptions }
      );

      expect(result.current.isExitModalOpen).toBe(false);
      expect(result.current.isUnderThreshold).toBe(true);

      // Engaged reader at page 5
      rerender({
        ...defaultOptions,
        currentGlobalPage: 5,
        currentChapterPage: 5,
      });
      expect(result.current.isUnderThreshold).toBe(false);
    });

    it('opens modal on handleHeaderBack when intercept conditions are met', () => {
      const { result } = renderHook(() => useReaderExitBookmark(defaultOptions));

      act(() => {
        result.current.handleHeaderBack();
      });

      expect(result.current.isExitModalOpen).toBe(true);

      act(() => {
        result.current.closeExitModal();
      });
      expect(result.current.isExitModalOpen).toBe(false);
    });

    it('performs immediate silent exit on handleHeaderBack when a bookmark is ahead', () => {
      useReaderStore.setState({
        readingPositions: {
          1342: {
            chapterIndex: 1,
            chapterPage: 2,
            globalPage: 8,
            bookmarkRow: 3,
            lastReadAt: new Date().toISOString(),
          },
        },
      });

      const { result } = renderHook(() => useReaderExitBookmark(defaultOptions));

      act(() => {
        result.current.handleHeaderBack();
      });

      expect(result.current.isExitModalOpen).toBe(false);
      expect(mockBack).toHaveBeenCalled();
    });

    it('performs immediate silent exit when exitBookmarkReminderEnabled is false or volume is finished', () => {
      const { result, rerender } = renderHook(
        (props) => useReaderExitBookmark(props),
        {
          initialProps: {
            ...defaultOptions,
            exitBookmarkReminderEnabled: false,
          },
        }
      );

      act(() => {
        result.current.handleHeaderBack();
      });
      expect(result.current.isExitModalOpen).toBe(false);
      expect(mockBack).toHaveBeenCalledTimes(1);

      // Finished volume
      rerender({
        ...defaultOptions,
        readingStatus: 'finished',
      });
      act(() => {
        result.current.handleHeaderBack();
      });
      expect(result.current.isExitModalOpen).toBe(false);
      expect(mockBack).toHaveBeenCalledTimes(2);
    });

    it('handles confirm exit without saving by closing modal and navigating', () => {
      const { result } = renderHook(() => useReaderExitBookmark(defaultOptions));

      act(() => {
        result.current.setIsExitModalOpen(true);
      });
      expect(result.current.isExitModalOpen).toBe(true);

      act(() => {
        result.current.handleConfirmExitWithoutSaving();
      });
      expect(result.current.isExitModalOpen).toBe(false);
      expect(mockBack).toHaveBeenCalled();
    });

    it('handles confirm bookmark and exit with default row 1 and extracted line text', () => {
      const setReadingStatus = vi.fn();
      const setBookmarkRow = vi.fn();

      const { result } = renderHook(() =>
        useReaderExitBookmark({
          ...defaultOptions,
          setReadingStatus,
          setBookmarkRow,
        })
      );

      act(() => {
        result.current.setIsExitModalOpen(true);
      });

      act(() => {
        result.current.handleConfirmBookmarkAndExit();
      });

      expect(result.current.isExitModalOpen).toBe(false);
      expect(setBookmarkRow).toHaveBeenCalledWith(1, 'It is a truth universally acknowledged.');
      expect(setReadingStatus).toHaveBeenCalledWith(1342, 'currently_reading', 'user-123');

      const savedPos = useReaderStore.getState().getReadingPosition(1342);
      expect(savedPos?.bookmarkRow).toBe(1);
      expect(savedPos?.bookmarkText).toBe('It is a truth universally acknowledged.');
      expect(mockBack).toHaveBeenCalled();
    });

    it('calls custom onExit callback when provided instead of default router navigation', () => {
      const onExit = vi.fn();
      const { result } = renderHook(() =>
        useReaderExitBookmark({
          ...defaultOptions,
          onExit,
        })
      );

      act(() => {
        result.current.handlePerformExit();
      });

      expect(onExit).toHaveBeenCalledTimes(1);
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('falls back to router.push("/") when window.history.length <= 1', () => {
      Object.defineProperty(window, 'history', {
        configurable: true,
        writable: true,
        value: { length: 1 },
      });

      const { result } = renderHook(() => useReaderExitBookmark(defaultOptions));

      act(() => {
        result.current.handlePerformExit();
      });

      expect(mockPush).toHaveBeenCalledWith('/');
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('prioritizes closing open drawers on handleHeaderBack and Escape key before opening the exit modal', () => {
      const closeAllDrawers = vi.fn();
      const { result, rerender } = renderHook(
        (props) => useReaderExitBookmark(props),
        {
          initialProps: {
            ...defaultOptions,
            isAnyDrawerOpen: true,
            closeAllDrawers,
          },
        }
      );

      // 1. handleHeaderBack when drawer is open closes drawer instead of opening modal
      act(() => {
        result.current.handleHeaderBack();
      });
      expect(closeAllDrawers).toHaveBeenCalledTimes(1);
      expect(result.current.isExitModalOpen).toBe(false);

      // 2. Escape key when drawer is open closes drawer instead of opening modal
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
      });
      expect(closeAllDrawers).toHaveBeenCalledTimes(2);
      expect(result.current.isExitModalOpen).toBe(false);

      // 3. When drawers are closed, Escape key invokes handleHeaderBack and opens modal
      rerender({
        ...defaultOptions,
        isAnyDrawerOpen: false,
        closeAllDrawers,
      });
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
      });
      expect(result.current.isExitModalOpen).toBe(true);

      // 4. When modal is open, Escape key closes the modal
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
      });
      expect(result.current.isExitModalOpen).toBe(false);
    });

    it('strips duplicate Page 1 chapter headings and resolves scrolled viewport row with immediateCloudSync on confirm', () => {
      const setReadingStatus = vi.fn();
      const setBookmarkRow = vi.fn();
      const saveSpy = vi.spyOn(useReaderStore.getState(), 'saveReadingPosition');

      // Mount mock main[role="main"] and [data-testid="reader-content-body"] showing scrolled state
      const mainEl = document.createElement('main');
      mainEl.setAttribute('role', 'main');
      Object.defineProperty(mainEl, 'scrollTop', { value: 180, configurable: true });
      Object.defineProperty(mainEl, 'clientHeight', { value: 400, configurable: true });
      mainEl.getBoundingClientRect = () =>
        ({ top: 0, bottom: 400, left: 0, right: 800, width: 800, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

      const contentEl = document.createElement('div');
      contentEl.setAttribute('data-testid', 'reader-content-body');
      contentEl.style.fontSize = '20px';
      contentEl.style.lineHeight = '2';
      contentEl.getBoundingClientRect = () =>
        ({ top: -120, bottom: 800, left: 0, right: 800, width: 800, height: 920, x: 0, y: -120, toJSON: () => ({}) }) as DOMRect;

      mainEl.appendChild(contentEl);
      document.body.appendChild(mainEl);

      try {
        const chaptersWithPagination = [
          {
            id: 1,
            title: 'CHAPTER I',
            displayTitle: 'Chapter I: The Hired Car',
            content:
              'CHAPTER I\n\nTHE HIRED CAR\n\nFirst body line.\nSecond body line.\nThird body line.\nFourth body line.\nFifth body line.',
            pageCount: 1,
            startPageNumber: 1,
            pages: [
              'CHAPTER I\n\nTHE HIRED CAR\n\nFirst body line.\nSecond body line.\nThird body line.\nFourth body line.\nFifth body line.',
            ],
          },
        ];

        const { result } = renderHook(() =>
          useReaderExitBookmark({
            ...defaultOptions,
            currentPageText:
              'CHAPTER I\n\nTHE HIRED CAR\n\nFirst body line.\nSecond body line.\nThird body line.\nFourth body line.\nFifth body line.',
            chaptersWithPagination,
            setReadingStatus,
            setBookmarkRow,
          })
        );

        act(() => {
          result.current.handleConfirmBookmarkAndExit();
        });

        expect(setBookmarkRow).toHaveBeenCalledWith(5, 'Fifth body line.');
        expect(saveSpy).toHaveBeenCalledWith(
          1342,
          expect.objectContaining({
            bookmarkRow: 5,
            bookmarkText: 'Fifth body line.',
          }),
          'user-123',
          { immediateCloudSync: true }
        );
      } finally {
        document.body.removeChild(mainEl);
        saveSpy.mockRestore();
      }
    });
  });
});

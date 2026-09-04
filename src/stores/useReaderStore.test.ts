import { describe, it, expect, beforeEach } from 'vitest';
import { useReaderStore } from './useReaderStore';
import { mockBooks } from '@/mocks/handlers';

describe('useReaderStore', () => {
  beforeEach(() => {
    useReaderStore.setState({
      currentBook: null,
      isOpen: false,
      fontSize: 18,
      lineHeight: 1.75,
      fontFamily: 'serif',
      theme: 'light',
      readingProgress: {},
    });
  });

  it('should initialize with default reader settings', () => {
    const state = useReaderStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.currentBook).toBeNull();
    expect(state.fontSize).toBe(18);
    expect(state.lineHeight).toBe(1.75);
    expect(state.fontFamily).toBe('serif');
    expect(state.theme).toBe('light');
  });

  it('should open and close reader modal with book', () => {
    const book = mockBooks[0];
    useReaderStore.getState().openReader(book);

    expect(useReaderStore.getState().isOpen).toBe(true);
    expect(useReaderStore.getState().currentBook?.title).toBe('Pride and Prejudice');

    useReaderStore.getState().closeReader();
    expect(useReaderStore.getState().isOpen).toBe(false);
  });

  it('should clamp font size between 12 and 36', () => {
    useReaderStore.getState().setFontSize(10);
    expect(useReaderStore.getState().fontSize).toBe(12);

    useReaderStore.getState().setFontSize(40);
    expect(useReaderStore.getState().fontSize).toBe(36);

    useReaderStore.getState().setFontSize(22);
    expect(useReaderStore.getState().fontSize).toBe(22);
  });

  it('should clamp line height between 1.2 and 2.6', () => {
    useReaderStore.getState().setLineHeight(0.8);
    expect(useReaderStore.getState().lineHeight).toBe(1.2);

    useReaderStore.getState().setLineHeight(3.0);
    expect(useReaderStore.getState().lineHeight).toBe(2.6);

    useReaderStore.getState().setLineHeight(1.8);
    expect(useReaderStore.getState().lineHeight).toBe(1.8);
  });

  it('should update theme and font family', () => {
    useReaderStore.getState().setTheme('sepia');
    expect(useReaderStore.getState().theme).toBe('sepia');

    useReaderStore.getState().setFontFamily('mono');
    expect(useReaderStore.getState().fontFamily).toBe('mono');
  });

  it('should record and retrieve reading progress percentage', () => {
    const bookId = 1342;
    expect(useReaderStore.getState().getProgress(bookId)).toBe(0);

    useReaderStore.getState().setProgress(bookId, 45);
    expect(useReaderStore.getState().getProgress(bookId)).toBe(45);

    useReaderStore.getState().setProgress(bookId, 1);
    expect(useReaderStore.getState().getProgress(bookId)).toBe(1);

    // clamping
    useReaderStore.getState().setProgress(bookId, 150);
    expect(useReaderStore.getState().getProgress(bookId)).toBe(100);

    // rounding
    useReaderStore.getState().setProgress(bookId, 0.578034);
    expect(useReaderStore.getState().getProgress(bookId)).toBe(1);
  });

  it('should save, retrieve, and clear exact reading positions', () => {
    const bookId = 1342;
    expect(useReaderStore.getState().getReadingPosition(bookId)).toBeNull();

    const position = {
      chapterIndex: 2,
      chapterPage: 4,
      globalPage: 12,
      lastReadAt: new Date().toISOString(),
    };

    useReaderStore.getState().saveReadingPosition(bookId, position);
    expect(useReaderStore.getState().getReadingPosition(bookId)).toEqual(position);

    useReaderStore.getState().clearReadingPosition(bookId);
    expect(useReaderStore.getState().getReadingPosition(bookId)).toBeNull();
  });

  it('should toggle and set isMobileTrayOpen', () => {
    expect(useReaderStore.getState().isMobileTrayOpen).toBe(false);

    useReaderStore.getState().toggleMobileTray();
    expect(useReaderStore.getState().isMobileTrayOpen).toBe(true);

    useReaderStore.getState().setMobileTrayOpen(false);
    expect(useReaderStore.getState().isMobileTrayOpen).toBe(false);

    useReaderStore.getState().setMobileTrayOpen(true);
    expect(useReaderStore.getState().isMobileTrayOpen).toBe(true);
  });
});


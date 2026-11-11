import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReaderAnnotationActions } from './useReaderAnnotationActions';
import type { Annotation, FellowAnnotation } from '@/stores/useAnnotationStore';

const existingAnnotation: Annotation = {
  id: 'ann-1',
  bookId: 1342,
  bookTitle: 'Pride and Prejudice',
  bookAuthor: 'Jane Austen',
  chapterIndex: 0,
  chapterPage: 1,
  selectedText: 'truth universally acknowledged',
  color: 'yellow',
  note: 'Initial note',
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z',
};

const fellowAnnotation: FellowAnnotation = {
  id: 'fellow-1',
  userId: 'user-2',
  fellowUsername: 'shelley',
  fellowDisplayName: 'Mary Shelley',
  bookId: 1342,
  chapterIndex: 0,
  chapterPage: 1,
  selectedText: 'truth universally acknowledged',
  color: 'rose',
  note: 'Brilliant irony',
  createdAt: '2026-01-01T12:00:00Z',
  updatedAt: '2026-01-01T12:00:00Z',
  isFellow: true,
};

describe('useReaderAnnotationActions', () => {
  it('handles text selection, existing annotation matching, color/note saves, and deletion queueing', async () => {
    const addAnnotation = vi.fn().mockResolvedValue(existingAnnotation);
    const updateAnnotationColor = vi.fn().mockResolvedValue(true);
    const updateAnnotationNote = vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useReaderAnnotationActions({
        numericId: 1342,
        bookTitle: 'Pride and Prejudice',
        bookAuthor: 'Jane Austen',
        userId: 'user-1',
        activeChapterIndex: 0,
        currentChapterPage: 1,
        activeChapterAnnotations: [existingAnnotation],
        activeChapterFellowAnnotations: [fellowAnnotation],
        addAnnotation,
        updateAnnotationColor,
        updateAnnotationNote,
      })
    );

    // Select a new passage that does not overlap
    act(() => {
      result.current.handleTextSelected({
        text: 'A brand new passage',
        position: { top: 100, left: 200 },
      });
    });

    expect(result.current.selectionPopover.isOpen).toBe(true);
    expect(result.current.selectionPopover.activeAnnotation).toBeNull();

    // Selecting a highlight color for new passage creates an annotation
    await act(async () => {
      await result.current.handleSelectColor('mint');
    });

    expect(addAnnotation).toHaveBeenCalledWith(
      {
        bookId: 1342,
        bookTitle: 'Pride and Prejudice',
        bookAuthor: 'Jane Austen',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'A brand new passage',
        color: 'mint',
      },
      'user-1'
    );
    expect(result.current.selectionPopover.isOpen).toBe(false);

    // Clicking an existing annotation opens popover with both own and overlapping fellow marginalia
    act(() => {
      result.current.handleSelectAnnotation(existingAnnotation, {
        top: 150,
        left: 250,
      });
    });

    expect(result.current.selectionPopover.isOpen).toBe(true);
    expect(result.current.selectionPopover.activeAnnotation?.id).toBe('ann-1');
    expect(result.current.selectionPopover.fellowAnnotation?.id).toBe(
      'fellow-1'
    );

    // Saving a note updates the existing annotation
    await act(async () => {
      await result.current.handleSaveNote('Updated scholarly note');
    });

    expect(updateAnnotationNote).toHaveBeenCalledWith(
      'ann-1',
      'Updated scholarly note',
      'user-1'
    );

    // Re-open and queue deletion
    act(() => {
      result.current.handleSelectAnnotation(existingAnnotation);
    });
    act(() => {
      result.current.handleDeleteAnnotation();
    });

    expect(result.current.annotationToDelete?.id).toBe('ann-1');
    expect(result.current.selectionPopover.isOpen).toBe(false);
  });
});

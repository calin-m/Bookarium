import { useState, useCallback } from 'react';
import {
  areAnnotationsOverlapping,
  findCanonicalTextSpan,
} from '@/lib/reader-annotator';
import type {
  Annotation,
  FellowAnnotation,
  HighlightColor,
} from '@/stores/useAnnotationStore';

export interface SelectionPopoverState {
  isOpen: boolean;
  selectedText: string;
  position: { top: number; left: number; bottom?: number } | null;
  activeAnnotation: Annotation | null;
  fellowAnnotation: FellowAnnotation | null;
  isFellowOnly: boolean;
}

export interface UseReaderAnnotationActionsOptions {
  numericId: number;
  bookTitle: string;
  bookAuthor: string;
  userId?: string;
  activeChapterIndex: number;
  currentChapterPage: number;
  activeChapterAnnotations: Annotation[];
  activeChapterFellowAnnotations: FellowAnnotation[];
  addAnnotation: (
    payload: {
      bookId: number;
      bookTitle: string;
      bookAuthor: string;
      chapterIndex: number;
      chapterPage: number;
      selectedText: string;
      color: HighlightColor;
      note?: string;
    },
    userId?: string
  ) => Promise<unknown> | unknown;
  updateAnnotationColor: (
    id: string,
    color: HighlightColor,
    userId?: string
  ) => Promise<unknown> | unknown;
  updateAnnotationNote: (
    id: string,
    note: string,
    userId?: string
  ) => Promise<unknown> | unknown;
}

/**
 * Encapsulates reader text-selection popover state, overlapping fellow/own annotation matching,
 * and highlight/note CRUD handlers for `src/app/read/[id]/page.tsx`.
 */
export function useReaderAnnotationActions({
  numericId,
  bookTitle,
  bookAuthor,
  userId,
  activeChapterIndex,
  currentChapterPage,
  activeChapterAnnotations,
  activeChapterFellowAnnotations,
  addAnnotation,
  updateAnnotationColor,
  updateAnnotationNote,
}: UseReaderAnnotationActionsOptions) {
  const [annotationToDelete, setAnnotationToDelete] =
    useState<Annotation | null>(null);
  const [selectionPopover, setSelectionPopover] =
    useState<SelectionPopoverState>({
      isOpen: false,
      selectedText: '',
      position: null,
      activeAnnotation: null,
      fellowAnnotation: null,
      isFellowOnly: false,
    });

  const dismissSelectionPopover = useCallback(() => {
    setSelectionPopover((prev) =>
      prev.isOpen ? { ...prev, isOpen: false } : prev
    );
  }, []);

  const handleTextSelected = useCallback(
    (selection: {
      text: string;
      position: { top: number; left: number; bottom?: number };
    }) => {
      const trimmed = selection.text.trim();
      const matchesPassage = (a: { selectedText: string }) => {
        const candidate = a.selectedText.trim();
        return (
          candidate.includes(trimmed) ||
          trimmed.includes(candidate) ||
          findCanonicalTextSpan(candidate, trimmed) !== null ||
          findCanonicalTextSpan(trimmed, candidate) !== null
        );
      };
      const ownMatch = activeChapterAnnotations.find(matchesPassage) || null;
      const fellowMatch =
        activeChapterFellowAnnotations.find(matchesPassage) || null;
      setSelectionPopover({
        isOpen: true,
        selectedText: selection.text,
        position: selection.position,
        activeAnnotation: ownMatch,
        fellowAnnotation: fellowMatch,
        isFellowOnly: false,
      });
    },
    [activeChapterAnnotations, activeChapterFellowAnnotations]
  );

  const handleSelectAnnotation = useCallback(
    (
      annotation: Annotation | FellowAnnotation,
      position?: { top: number; left: number; bottom?: number },
      overlappingFellow?: FellowAnnotation
    ) => {
      if (typeof window === 'undefined') return;
      const isFellowClicked =
        'isFellow' in annotation && annotation.isFellow === true;
      const ownAnn = isFellowClicked
        ? activeChapterAnnotations.find((a) =>
            areAnnotationsOverlapping(a, annotation)
          ) || null
        : (annotation as Annotation);
      const fellowAnn = isFellowClicked
        ? (annotation as FellowAnnotation)
        : overlappingFellow ||
          activeChapterFellowAnnotations.find((fa) =>
            areAnnotationsOverlapping(annotation, fa)
          ) ||
          null;
      setSelectionPopover({
        isOpen: true,
        selectedText: annotation.selectedText,
        position: position || { top: 140, left: window.innerWidth / 2 },
        activeAnnotation: ownAnn,
        fellowAnnotation: fellowAnn,
        isFellowOnly: Boolean(fellowAnn && !ownAnn),
      });
    },
    [activeChapterAnnotations, activeChapterFellowAnnotations]
  );

  const saveNewBookAnnotation = useCallback(
    async (params: {
      chapterIndex: number;
      chapterPage: number;
      selectedText: string;
      color: HighlightColor;
      note?: string;
    }) => {
      await addAnnotation(
        {
          bookId: numericId,
          bookTitle,
          bookAuthor,
          ...params,
        },
        userId
      );
    },
    [addAnnotation, numericId, bookTitle, bookAuthor, userId]
  );

  const handleSelectColor = useCallback(
    async (color: HighlightColor) => {
      if (selectionPopover.activeAnnotation) {
        await updateAnnotationColor(
          selectionPopover.activeAnnotation.id,
          color,
          userId
        );
      } else {
        await saveNewBookAnnotation({
          chapterIndex: activeChapterIndex,
          chapterPage: currentChapterPage,
          selectedText: selectionPopover.selectedText,
          color,
        });
      }
      setSelectionPopover((prev) => ({ ...prev, isOpen: false }));
    },
    [
      selectionPopover.activeAnnotation,
      selectionPopover.selectedText,
      activeChapterIndex,
      currentChapterPage,
      updateAnnotationColor,
      saveNewBookAnnotation,
      userId,
    ]
  );

  const handleSaveNote = useCallback(
    async (note: string) => {
      if (selectionPopover.activeAnnotation) {
        await updateAnnotationNote(
          selectionPopover.activeAnnotation.id,
          note,
          userId
        );
      } else {
        await saveNewBookAnnotation({
          chapterIndex: activeChapterIndex,
          chapterPage: currentChapterPage,
          selectedText: selectionPopover.selectedText,
          color: 'yellow',
          note,
        });
      }
      setSelectionPopover((prev) => ({ ...prev, isOpen: false }));
    },
    [
      selectionPopover.activeAnnotation,
      selectionPopover.selectedText,
      updateAnnotationNote,
      saveNewBookAnnotation,
      activeChapterIndex,
      currentChapterPage,
      userId,
    ]
  );

  const handleDeleteAnnotation = useCallback(() => {
    if (selectionPopover.activeAnnotation) {
      setAnnotationToDelete(selectionPopover.activeAnnotation);
    }
    setSelectionPopover((prev) => ({ ...prev, isOpen: false }));
  }, [selectionPopover.activeAnnotation]);

  return {
    annotationToDelete,
    setAnnotationToDelete,
    selectionPopover,
    setSelectionPopover,
    dismissSelectionPopover,
    handleTextSelected,
    handleSelectAnnotation,
    saveNewBookAnnotation,
    handleSelectColor,
    handleSaveNote,
    handleDeleteAnnotation,
  };
}

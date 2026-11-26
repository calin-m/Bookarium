import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderHighlightAdjustOverlay } from './ReaderHighlightAdjustOverlay';
import type { Annotation } from '@/stores/useAnnotationStore';

const sampleAnnotation: Annotation = {
  id: 'ann-adjust-1',
  bookId: 1342,
  chapterIndex: 0,
  chapterPage: 1,
  selectedText: 'universally acknowledged',
  color: 'indigo',
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z',
};

describe('ReaderHighlightAdjustOverlay', () => {
  const baseProps = {
    annotation: sampleAnnotation,
    draftStart: 12,
    draftEnd: 36,
    totalTextLength: 140,
    draftText: 'universally acknowledged',
    occurrenceCount: 1,
    hasChanged: true,
    startBox: { top: 20, left: 40, bottom: 40, right: 50, width: 10, height: 20 },
    endBox: { top: 20, left: 190, bottom: 40, right: 202, width: 12, height: 20 },
    containerSize: { width: 640, height: 420 },
    draggingEdge: null as 'start' | 'end' | null,
    theme: 'light' as const,
    onStartDrag: vi.fn(),
    onStepWord: vi.fn(),
    onStepRow: vi.fn(),
    onExpandSentence: vi.fn(),
    onExpandParagraph: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders accessible crop sliders, supports keyboard word/row navigation, and invokes sentence/paragraph/save/cancel controls', () => {
    const onStartDrag = vi.fn();
    const onStepWord = vi.fn();
    const onStepRow = vi.fn();
    const onExpandSentence = vi.fn();
    const onExpandParagraph = vi.fn();
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(
      <ReaderHighlightAdjustOverlay
        {...baseProps}
        onStartDrag={onStartDrag}
        onStepWord={onStepWord}
        onStepRow={onStepRow}
        onExpandSentence={onExpandSentence}
        onExpandParagraph={onExpandParagraph}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    const startHandle = screen.getByTestId('highlight-adjust-handle-start');
    const endHandle = screen.getByTestId('highlight-adjust-handle-end');
    expect(startHandle).toHaveAttribute('role', 'slider');
    expect(endHandle).toHaveAttribute('role', 'slider');
    expect(startHandle).toHaveAttribute('aria-valuenow', '12');
    expect(endHandle).toHaveAttribute('aria-valuenow', '36');

    fireEvent.pointerDown(startHandle);
    expect(onStartDrag).toHaveBeenCalledWith('start');

    fireEvent.keyDown(startHandle, { key: 'ArrowLeft' });
    expect(onStepWord).toHaveBeenCalledWith('start', -1);

    fireEvent.keyDown(endHandle, { key: 'ArrowRight' });
    expect(onStepWord).toHaveBeenCalledWith('end', 1);

    fireEvent.keyDown(endHandle, { key: 'ArrowDown' });
    expect(onStepRow).toHaveBeenCalledWith('end', 1);

    fireEvent.keyDown(endHandle, { key: 'ArrowUp' });
    expect(onStepRow).toHaveBeenCalledWith('end', -1);

    fireEvent.keyDown(endHandle, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(endHandle, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('adjust-expand-sentence-btn'));
    expect(onExpandSentence).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('adjust-expand-paragraph-btn'));
    expect(onExpandParagraph).toHaveBeenCalledTimes(1);

    expect(screen.queryByTestId('adjust-ambiguity-warning')).not.toBeInTheDocument();
  });

  it('displays repeated-passage warning badge when occurrenceCount > 1 and disables Save when unchanged or under minimum length', () => {
    const onSave = vi.fn();

    const { rerender } = render(
      <ReaderHighlightAdjustOverlay
        {...baseProps}
        occurrenceCount={3}
        hasChanged={false}
        onSave={onSave}
      />
    );

    expect(screen.getByTestId('adjust-ambiguity-warning')).toHaveTextContent('Matches 3 passages');
    const saveBtn = screen.getByTestId('adjust-save-btn');
    expect(saveBtn).toBeDisabled();
    fireEvent.click(saveBtn);
    expect(onSave).not.toHaveBeenCalled();

    // Below 2 chars also keeps Save disabled even if hasChanged is true
    rerender(
      <ReaderHighlightAdjustOverlay
        {...baseProps}
        draftText="a"
        hasChanged={true}
        onSave={onSave}
      />
    );
    expect(screen.getByTestId('adjust-save-btn')).toBeDisabled();
  });

  it('supports touch drag initiation, Cancel click, sepia/dark palettes, null fallback rects, and flips toolbar above bottom edges', () => {
    const onStartDrag = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <ReaderHighlightAdjustOverlay
        {...baseProps}
        theme="sepia"
        draggingEdge="end"
        startBox={null}
        endBox={null}
        onStartDrag={onStartDrag}
        onCancel={onCancel}
      />
    );

    const startHandle = screen.getByTestId('highlight-adjust-handle-start');
    const endHandle = screen.getByTestId('highlight-adjust-handle-end');
    fireEvent.touchStart(startHandle);
    fireEvent.pointerDown(endHandle);
    fireEvent.touchStart(endHandle);
    expect(onStartDrag).toHaveBeenCalledWith('start');
    expect(onStartDrag).toHaveBeenCalledWith('end');

    fireEvent.click(screen.getByTestId('adjust-cancel-btn'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Dark theme + near-bottom endBox triggers upward toolbar flip cleanly and shifts barLeft wide enough near right edge
    rerender(
      <ReaderHighlightAdjustOverlay
        {...baseProps}
        theme="dark"
        startBox={{ top: 140, left: 40, bottom: 160, right: 52, width: 12, height: 20 }}
        endBox={{ top: 360, left: 590, bottom: 380, right: 628, width: 12, height: 20 }}
        containerSize={{ width: 640, height: 420 }}
        occurrenceCount={2}
        isMaxLengthReached={true}
        canExpandParagraph={false}
        onStartDrag={onStartDrag}
        onCancel={onCancel}
      />
    );

    const toolbar = screen.getByTestId('highlight-adjust-toolbar');
    expect(toolbar.className).toContain('w-max');
    // Shifts far enough left (640 - 380 - 8 = 252px max) so Cancel & Save stay on the same row
    expect(parseInt(toolbar.style.left, 10)).toBeLessThanOrEqual(272);
    expect(screen.getByTestId('highlight-adjust-actions-row').className).toContain('whitespace-nowrap');
    expect(screen.getByTestId('highlight-adjust-status-row')).toContainElement(
      screen.getByTestId('adjust-ambiguity-warning')
    );
    expect(screen.getByTestId('adjust-max-length-badge')).toHaveTextContent('5,000 char limit');
    expect(screen.getByTestId('adjust-expand-paragraph-btn')).toBeDisabled();
    expect(screen.getByTestId('adjust-expand-sentence-btn')).toHaveAttribute('title');
    expect(screen.getByTestId('adjust-cancel-btn')).toHaveAttribute('title', 'Discard selection changes (Esc)');
  });
});

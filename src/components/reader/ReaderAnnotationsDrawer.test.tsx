import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReaderAnnotationsDrawer } from './ReaderAnnotationsDrawer';
import type { Annotation } from '@/stores/useAnnotationStore';

describe('ReaderAnnotationsDrawer', () => {
  const mockAnnotations: Annotation[] = [
    {
      id: 'ann-1',
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'It is a truth universally acknowledged...',
      color: 'yellow',
      note: 'Famous opening quote',
      createdAt: '2026-09-03T10:00:00Z',
      updatedAt: '2026-09-03T10:00:00Z',
    },
    {
      id: 'ann-2',
      bookId: 1342,
      chapterIndex: 2,
      chapterPage: 3,
      selectedText: 'She is tolerable, but not handsome enough to tempt me.',
      color: 'rose',
      createdAt: '2026-09-03T10:05:00Z',
      updatedAt: '2026-09-03T10:05:00Z',
    },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    annotations: mockAnnotations,
    bookTitle: 'Pride and Prejudice',
    onJumpToAnnotation: vi.fn(),
    onDeleteAnnotation: vi.fn(),
    onUpdateNote: vi.fn(),
  };

  it('renders annotations list with quotes and section pills', () => {
    render(<ReaderAnnotationsDrawer {...defaultProps} />);

    expect(screen.getByTestId('annotations-drawer-panel')).toBeInTheDocument();
    expect(screen.getByText(/Notes & Highlights \(2\)/)).toBeInTheDocument();
    expect(screen.getByTestId('annotation-item-ann-1')).toBeInTheDocument();
    expect(screen.getByTestId('annotation-item-ann-2')).toBeInTheDocument();
    expect(screen.getByText('Famous opening quote')).toBeInTheDocument();
    expect(screen.getByText(/Sec 1 · Page 1/)).toBeInTheDocument();
  });

  it('renders empty state when there are no annotations', () => {
    render(<ReaderAnnotationsDrawer {...defaultProps} annotations={[]} />);

    expect(screen.getByTestId('annotations-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No Highlights Yet')).toBeInTheDocument();
  });

  it('filters annotations by color tab', () => {
    render(<ReaderAnnotationsDrawer {...defaultProps} />);

    // Click Yellow filter
    fireEvent.click(screen.getByTestId('filter-color-yellow'));
    expect(screen.getByTestId('annotation-item-ann-1')).toBeInTheDocument();
    expect(screen.queryByTestId('annotation-item-ann-2')).not.toBeInTheDocument();

    // Click Rose filter
    fireEvent.click(screen.getByTestId('filter-color-rose'));
    expect(screen.queryByTestId('annotation-item-ann-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('annotation-item-ann-2')).toBeInTheDocument();
  });

  it('filters annotations by search input', () => {
    render(<ReaderAnnotationsDrawer {...defaultProps} />);

    const searchInput = screen.getByTestId('annotations-search-input');
    fireEvent.change(searchInput, { target: { value: 'tolerable' } });

    expect(screen.queryByTestId('annotation-item-ann-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('annotation-item-ann-2')).toBeInTheDocument();
  });

  it('calls onJumpToAnnotation and closes drawer when jump button is clicked', () => {
    const onJumpToAnnotation = vi.fn();
    const onClose = vi.fn();

    render(
      <ReaderAnnotationsDrawer
        {...defaultProps}
        onJumpToAnnotation={onJumpToAnnotation}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByTestId('annotation-jump-btn-ann-1'));
    expect(onJumpToAnnotation).toHaveBeenCalledWith(0, 1);
    expect(onClose).toHaveBeenCalled();
  });

  it('allows editing an annotation note', () => {
    const onUpdateNote = vi.fn();
    render(<ReaderAnnotationsDrawer {...defaultProps} onUpdateNote={onUpdateNote} />);

    fireEvent.click(screen.getByTestId('annotation-edit-btn-ann-1'));

    const textarea = screen.getByTestId('annotation-edit-textarea');
    fireEvent.change(textarea, { target: { value: 'Updated analysis note' } });

    fireEvent.click(screen.getByTestId('annotation-save-edit-btn'));
    expect(onUpdateNote).toHaveBeenCalledWith('ann-1', 'Updated analysis note');
  });

  it('shows confirmation modal and calls onDeleteAnnotation when confirmed', () => {
    const onDeleteAnnotation = vi.fn();
    render(<ReaderAnnotationsDrawer {...defaultProps} onDeleteAnnotation={onDeleteAnnotation} />);

    fireEvent.click(screen.getByTestId('annotation-delete-btn-ann-1'));

    expect(screen.getByTestId('delete-single-note-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Saved Highlight & Note?')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Delete Note/i });
    fireEvent.click(confirmBtn);

    expect(onDeleteAnnotation).toHaveBeenCalledWith('ann-1');
  });

  it('cancels deletion when clicking cancel in modal', () => {
    const onDeleteAnnotation = vi.fn();
    render(<ReaderAnnotationsDrawer {...defaultProps} onDeleteAnnotation={onDeleteAnnotation} />);

    fireEvent.click(screen.getByTestId('annotation-delete-btn-ann-1'));

    expect(screen.getByTestId('delete-single-note-dialog')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('delete-single-note-dialog')).not.toBeInTheDocument();
    expect(onDeleteAnnotation).not.toHaveBeenCalled();
  });

  it('translates vertical wheel scroll to horizontal scroll on color filter tags', () => {
    render(<ReaderAnnotationsDrawer {...defaultProps} />);

    const colorTabs = screen.getByTestId('annotations-color-tabs');
    expect(colorTabs).toBeInTheDocument();

    colorTabs.scrollLeft = 0;

    const wheelDownEvent = new WheelEvent('wheel', {
      deltaY: 100,
      deltaX: 0,
      cancelable: true,
      bubbles: true,
    });
    colorTabs.dispatchEvent(wheelDownEvent);

    expect(colorTabs.scrollLeft).toBe(100);
    expect(wheelDownEvent.defaultPrevented).toBe(true);

    const wheelUpEvent = new WheelEvent('wheel', {
      deltaY: -50,
      deltaX: 0,
      cancelable: true,
      bubbles: true,
    });
    colorTabs.dispatchEvent(wheelUpEvent);

    expect(colorTabs.scrollLeft).toBe(50);
    expect(wheelUpEvent.defaultPrevented).toBe(true);
  });
});


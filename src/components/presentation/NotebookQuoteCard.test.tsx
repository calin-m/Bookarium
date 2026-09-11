import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { NotebookQuoteCard } from './NotebookQuoteCard';
import type { Annotation } from '@/stores/useAnnotationStore';

describe('NotebookQuoteCard', () => {
  const mockAnnotation: Annotation = {
    id: 'ann-1',
    bookId: 1342,
    chapterIndex: 0,
    chapterPage: 1,
    selectedText: 'It is a truth universally acknowledged.',
    color: 'yellow',
    note: 'Initial reflection',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const defaultProps = {
    annotation: mockAnnotation,
    bookTitle: 'Pride and Prejudice',
    bookAuthor: 'Jane Austen',
    isEditing: false,
    onStartEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onSaveNote: vi.fn(),
    onUpdateColor: vi.fn(),
    onRequestDeleteReflection: vi.fn(),
    onRequestDeleteAnnotation: vi.fn(),
    onJumpToReader: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders book metadata, quote excerpt, and note', () => {
    render(<NotebookQuoteCard {...defaultProps} />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText(/by Jane Austen/i)).toBeInTheDocument();
    expect(screen.getByText(/Section 1, p. 1/i)).toBeInTheDocument();
    expect(screen.getByText(/It is a truth universally acknowledged/i)).toBeInTheDocument();
    expect(screen.getByText('Initial reflection')).toBeInTheDocument();
    expect(screen.getByTestId('color-badge-btn-ann-1')).toHaveTextContent('yellow');
  });

  it('renders Protected badge when isRestricted is true', () => {
    render(<NotebookQuoteCard {...defaultProps} isRestricted={true} jurisdictionCountry="RO" />);

    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText(/by Jane Austen/i)).toBeInTheDocument();
  });

  it('toggles color swatch popover and updates color on click', async () => {
    render(<NotebookQuoteCard {...defaultProps} />);

    const badgeBtn = screen.getByTestId('color-badge-btn-ann-1');
    fireEvent.click(badgeBtn);

    expect(screen.getByTestId('quick-color-popover-ann-1')).toBeInTheDocument();

    const mintBtn = screen.getByTestId('quick-color-btn-ann-1-mint');
    await act(async () => {
      fireEvent.click(mintBtn);
    });

    expect(defaultProps.onUpdateColor).toHaveBeenCalledWith('ann-1', 'mint');
    expect(screen.queryByTestId('quick-color-popover-ann-1')).not.toBeInTheDocument();
  });

  it('dismisses color popover when pressing Escape', () => {
    render(<NotebookQuoteCard {...defaultProps} />);

    fireEvent.click(screen.getByTestId('color-badge-btn-ann-1'));
    expect(screen.getByTestId('quick-color-popover-ann-1')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('quick-color-popover-ann-1')).not.toBeInTheDocument();
  });

  it('enters edit mode and handles saving modified note and color shade', async () => {
    const handleSaveNote = vi.fn();
    const { rerender } = render(
      <NotebookQuoteCard {...defaultProps} isEditing={false} onSaveNote={handleSaveNote} />
    );

    fireEvent.click(screen.getByLabelText('Edit personal reflection'));
    expect(defaultProps.onStartEdit).toHaveBeenCalledWith(mockAnnotation);

    // Re-render in editing mode
    rerender(<NotebookQuoteCard {...defaultProps} isEditing={true} onSaveNote={handleSaveNote} />);

    const textarea = screen.getByTestId('edit-note-textarea-ann-1');
    expect(textarea).toHaveValue('Initial reflection');
    fireEvent.change(textarea, { target: { value: 'Updated deeper thought' } });

    // Pick rose shade
    fireEvent.click(screen.getByTestId('edit-color-btn-ann-1-rose'));

    // Save
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save Note/i }));
    });

    expect(handleSaveNote).toHaveBeenCalledWith(
      'ann-1',
      'Updated deeper thought',
      'rose',
      'yellow'
    );
  });

  it('calls onCancelEdit when cancelling editing', () => {
    render(<NotebookQuoteCard {...defaultProps} isEditing={true} />);

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(defaultProps.onCancelEdit).toHaveBeenCalledTimes(1);
  });

  it('triggers delete reflection from editor and from note header', () => {
    // 1. From note header
    const { rerender } = render(<NotebookQuoteCard {...defaultProps} isEditing={false} />);
    fireEvent.click(screen.getByTestId('delete-reflection-btn-ann-1'));
    expect(defaultProps.onRequestDeleteReflection).toHaveBeenCalledWith(mockAnnotation);

    // 2. From edit mode
    rerender(<NotebookQuoteCard {...defaultProps} isEditing={true} />);
    fireEvent.click(screen.getByTestId('delete-reflection-editor-btn-ann-1'));
    expect(defaultProps.onRequestDeleteReflection).toHaveBeenCalledWith(mockAnnotation);
  });

  it('triggers delete annotation and jump to reader from card footer', () => {
    render(<NotebookQuoteCard {...defaultProps} />);

    fireEvent.click(screen.getByTestId('delete-quote-btn-ann-1'));
    expect(defaultProps.onRequestDeleteAnnotation).toHaveBeenCalledWith(mockAnnotation);

    fireEvent.click(screen.getByTestId('jump-reader-btn-ann-1'));
    expect(defaultProps.onJumpToReader).toHaveBeenCalledWith(mockAnnotation);
  });

  it('copies formatted citation to clipboard and displays Copied state', async () => {
    const originalClipboard = navigator.clipboard;
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<NotebookQuoteCard {...defaultProps} />);

    fireEvent.click(screen.getByTestId('copy-citation-btn-ann-1'));

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('Jane Austen, Pride and Prejudice')
    );
    expect(screen.getByText('Copied')).toBeInTheDocument();

    Object.assign(navigator, { clipboard: originalClipboard });
  });

  it('displays Add a personal note prompt when annotation has no note', () => {
    const noNoteAnn: Annotation = { ...mockAnnotation, note: undefined };
    render(<NotebookQuoteCard {...defaultProps} annotation={noNoteAnn} isEditing={false} />);

    const addBtn = screen.getByText('Add a personal note...');
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);
    expect(defaultProps.onStartEdit).toHaveBeenCalledWith(noNoteAnn);
  });
});


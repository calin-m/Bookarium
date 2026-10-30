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

  it('renders Fellow Marginalia attribution badge and hides edit/delete controls for fellow annotations', () => {
    const fellowAnnotation = {
      ...mockAnnotation,
      id: 'fellow-ann-1',
      isFellow: true as const,
      fellowUsername: 'clara_v',
      fellowDisplayName: 'Clara Vance',
    };

    const { rerender } = render(<NotebookQuoteCard {...defaultProps} annotation={fellowAnnotation} />);

    expect(screen.getByTestId('notebook-fellow-badge-fellow-ann-1')).toHaveTextContent(
      'Clara Vance (@clara_v)'
    );
    expect(screen.getByText('Fellow Reflection (Clara Vance (@clara_v))')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-quote-btn-fellow-ann-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-quote-btn-fellow-ann-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('jump-reader-btn-fellow-ann-1')).toBeInTheDocument();

    // Rerender with placeholder fellowUsername 'scholar' to assert clean displayName without (@scholar)
    const placeholderFellowAnn = {
      ...fellowAnnotation,
      id: 'fellow-ann-placeholder',
      fellowUsername: 'scholar',
    };
    rerender(<NotebookQuoteCard {...defaultProps} annotation={placeholderFellowAnn} />);
    expect(screen.getByTestId('notebook-fellow-badge-fellow-ann-placeholder')).toHaveTextContent(
      'Clara Vance'
    );
    expect(screen.getByText('Fellow Reflection (Clara Vance)')).toBeInTheDocument();

    // Rerender with empty fellowDisplayName to assert @fellowUsername fallback
    const anonymousFellowAnn = {
      ...fellowAnnotation,
      id: 'fellow-ann-2',
      fellowDisplayName: '',
    };
    rerender(<NotebookQuoteCard {...defaultProps} annotation={anonymousFellowAnn} />);
    expect(screen.getByText('Fellow Reflection (@clara_v)')).toBeInTheDocument();
  });

  it('renders paired fellow badge, shared quote overlap span, and stacked reflections when pairedFellowAnnotation is present', () => {
    const pairedFellow = {
      id: 'fellow-ann-paired',
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
      color: 'amber' as const,
      note: 'A timeless classical satire on matrimonial economics.',
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
      fellowUserId: 'user-fellow-1',
      fellowUsername: 'clara_v',
      fellowDisplayName: 'Clara Vance',
      isFellow: true as const,
    };

    render(
      <NotebookQuoteCard
        {...defaultProps}
        annotation={{
          ...mockAnnotation,
          selectedText: 'It is a truth universally acknowledged',
        }}
        pairedFellowAnnotation={pairedFellow}
      />
    );

    // Both badges present
    expect(screen.getByTestId('color-badge-btn-ann-1')).toBeInTheDocument();
    expect(screen.getByTestId('notebook-fellow-badge-fellow-ann-paired')).toHaveTextContent(
      'Clara Vance (@clara_v)'
    );

    // Shared quote markup
    expect(screen.getByTestId('shared-quote-overlap-span')).toHaveTextContent(
      'It is a truth universally acknowledged'
    );

    // Both reflections present: own note and fellow paired note
    expect(screen.getByText('Initial reflection')).toBeInTheDocument();
    expect(
      screen.getByTestId('notebook-paired-fellow-note-fellow-ann-paired')
    ).toHaveTextContent('A timeless classical satire on matrimonial economics.');
    expect(screen.getByText('Fellow Reflection (Clara Vance (@clara_v))')).toBeInTheDocument();
  });

  it('renders fellow box with fallback attribution line when pairedFellowAnnotation has no written note', () => {
    const pairedFellowNoNote = {
      id: 'fellow-no-note',
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'It is a truth universally acknowledged',
      color: 'amber' as const,
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
      fellowUsername: 'clara_v',
      fellowDisplayName: 'Clara Vance',
      isFellow: true as const,
    };

    render(
      <NotebookQuoteCard
        {...defaultProps}
        annotation={mockAnnotation}
        pairedFellowAnnotation={pairedFellowNoNote}
      />
    );

    const fellowBox = screen.getByTestId('notebook-paired-fellow-note-fellow-no-note');
    expect(fellowBox).toBeInTheDocument();
    expect(fellowBox).toHaveTextContent('Fellow Reflection (Clara Vance (@clara_v))');
    expect(fellowBox).toHaveTextContent('Also saved and highlighted in this Literary Symposium.');
  });

  it('renders Save to My Notes button on standalone fellow note and calls onSaveFellowAsOwn', async () => {
    const fellowAnnotation = {
      ...mockAnnotation,
      id: 'fellow-ann-saveable',
      isFellow: true as const,
      fellowUsername: 'marcus_a',
      fellowDisplayName: 'Marcus Aurelius',
    };
    const onSaveFellowAsOwnMock = vi.fn().mockResolvedValue(undefined);

    render(
      <NotebookQuoteCard
        {...defaultProps}
        annotation={fellowAnnotation}
        onSaveFellowAsOwn={onSaveFellowAsOwnMock}
      />
    );

    const saveBtn = screen.getByTestId('notebook-save-fellow-btn-fellow-ann-saveable');
    expect(saveBtn).toHaveTextContent('Save to My Notes');

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(onSaveFellowAsOwnMock).toHaveBeenCalledWith(fellowAnnotation);
  });

  it('renders In My Notes badge and Edit My Note when matching personal annotation exists', async () => {
    const fellowAnnotation = {
      ...mockAnnotation,
      id: 'fellow-ann-with-match',
      isFellow: true as const,
      fellowUsername: 'marcus_a',
      fellowDisplayName: 'Marcus Aurelius',
      note: 'Fellow philosophy reflection',
    };
    const matchingOwn = {
      ...mockAnnotation,
      id: 'own-match-1',
      note: 'My stoic meditation',
      color: 'mint' as const,
    };
    const onSaveFellowAsOwnMock = vi.fn().mockResolvedValue(undefined);

    render(
      <NotebookQuoteCard
        {...defaultProps}
        annotation={fellowAnnotation}
        matchingOwnAnnotation={matchingOwn}
        onSaveFellowAsOwn={onSaveFellowAsOwnMock}
      />
    );

    // Save to My Notes should NOT be present; In My Notes badge should be rendered
    expect(screen.queryByTestId('notebook-save-fellow-btn-fellow-ann-with-match')).not.toBeInTheDocument();
    expect(screen.getByTestId('notebook-fellow-saved-badge-fellow-ann-with-match')).toHaveTextContent('In My Notes');

    // Matching personal reflection should be displayed
    expect(screen.getByTestId('notebook-matching-own-note-fellow-ann-with-match')).toHaveTextContent('My stoic meditation');

    // Action button says Edit My Note
    const editBtn = screen.getByTestId('notebook-add-fellow-note-btn-fellow-ann-with-match');
    expect(editBtn).toHaveTextContent('Edit My Note');

    // Click Edit My Note to open textarea pre-filled with existing note
    fireEvent.click(editBtn);
    const textarea = screen.getByTestId('notebook-fellow-note-textarea-fellow-ann-with-match') as HTMLTextAreaElement;
    expect(textarea.value).toBe('My stoic meditation');

    // Edit and save
    fireEvent.change(textarea, { target: { value: 'Updated stoic reflection' } });
    const saveNoteBtn = screen.getByTestId('notebook-save-fellow-with-note-btn-fellow-ann-with-match');

    await act(async () => {
      fireEvent.click(saveNoteBtn);
    });

    expect(onSaveFellowAsOwnMock).toHaveBeenCalledWith(
      fellowAnnotation,
      'Updated stoic reflection',
      'mint'
    );
  });

  it('disables Read Passage button without repeating topline Not Downloaded pill when isUnavailableOffline is true', () => {
    render(<NotebookQuoteCard {...defaultProps} isUnavailableOffline={true} />);

    expect(screen.queryByTestId('quote-card-offline-badge-ann-1')).not.toBeInTheDocument();
    const jumpBtn = screen.getByTestId('jump-reader-btn-ann-1');
    expect(jumpBtn).toBeDisabled();
    expect(jumpBtn).toHaveTextContent('Unavailable Offline');

    fireEvent.click(jumpBtn);
    expect(defaultProps.onJumpToReader).not.toHaveBeenCalled();

    // Clicking the unified Title + Author topline block copies the book link
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    const copyBlock = screen.getByTestId('notebook-card-copy-meta-ann-1');
    expect(copyBlock).toHaveAttribute('data-copy-book-id', '1342');
    fireEvent.click(copyBlock);
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringMatching(/\/read\/1342$/));
    expect(screen.getByTestId('copy-book-link-indicator-1342')).toHaveTextContent('Copied!');
  });
});



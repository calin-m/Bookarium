import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { NotebookView } from './NotebookView';
import { useAnnotationStore } from '@/stores/useAnnotationStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('NotebookView component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAnnotationStore.getState().clearAllAnnotations();
    useBookshelfStore.getState().clearBookshelf();
  });

  it('renders empty state when there are no annotations', () => {
    const handleBrowse = vi.fn();
    render(<NotebookView onBrowseCatalog={handleBrowse} />);

    expect(screen.getByText('Your Notebook is Empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Explore Catalog/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Explore Catalog/i }));
    expect(handleBrowse).toHaveBeenCalledTimes(1);
  });

  it('renders saved annotations grouped by volume with resolved metadata', async () => {
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'It is a truth universally acknowledged...',
      color: 'yellow',
      note: 'Famous opening quote',
    });

    render(<NotebookView />);

    expect(screen.getByText('Literary Notebook')).toBeInTheDocument();
    expect(screen.getAllByText('Pride and Prejudice').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/by Jane Austen/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/It is a truth universally acknowledged/i)).toBeInTheDocument();
    expect(screen.getByText('Famous opening quote')).toBeInTheDocument();
    expect(screen.getByText('yellow')).toBeInTheDocument();
  });

  it('filters annotations by search query across quote, note, title, and author', async () => {
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Gentleman of good fortune',
      color: 'yellow',
      note: 'Elizabeth Bennet reflection',
    });
    await useAnnotationStore.getState().addAnnotation({
      bookId: 84,
      bookTitle: 'Frankenstein',
      bookAuthor: 'Mary Shelley',
      chapterIndex: 2,
      chapterPage: 1,
      selectedText: 'I beheld the wretch',
      color: 'rose',
      note: 'Monster creation',
    });

    render(<NotebookView />);

    const searchInput = screen.getByTestId('notebook-search-input');

    // Filter by author name
    fireEvent.change(searchInput, { target: { value: 'Shelley' } });
    expect(screen.getAllByText('Frankenstein').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Pride and Prejudice')).not.toBeInTheDocument();

    // Clear search button
    const clearBtn = screen.getByLabelText('Clear search');
    fireEvent.click(clearBtn);
    expect(screen.getAllByText('Pride and Prejudice').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Frankenstein').length).toBeGreaterThanOrEqual(1);
  });

  it('filters annotations by pastel color tabs', async () => {
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Yellow quote',
      color: 'yellow',
    });
    await useAnnotationStore.getState().addAnnotation({
      bookId: 84,
      bookTitle: 'Frankenstein',
      bookAuthor: 'Mary Shelley',
      chapterIndex: 1,
      chapterPage: 1,
      selectedText: 'Mint quote',
      color: 'mint',
    });

    render(<NotebookView />);

    // Click Mint filter
    const mintFilter = screen.getByTestId('notebook-filter-mint');
    fireEvent.click(mintFilter);

    expect(screen.getByText(/Mint quote/i)).toBeInTheDocument();
    expect(screen.queryByText(/Yellow quote/i)).not.toBeInTheDocument();

    // Click All filter
    const allFilter = screen.getByTestId('notebook-filter-all');
    fireEvent.click(allFilter);
    expect(screen.getByText(/Mint quote/i)).toBeInTheDocument();
    expect(screen.getByText(/Yellow quote/i)).toBeInTheDocument();
  });

  it('allows toggling between By Book grouping and Chronological stream', async () => {
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Book quote 1',
      color: 'yellow',
    });

    render(<NotebookView />);

    const chronoBtn = screen.getByRole('button', { name: /Chronological/i });
    fireEvent.click(chronoBtn);

    expect(screen.getByText(/Book quote 1/i)).toBeInTheDocument();

    const byBookBtn = screen.getByRole('button', { name: /By Book/i });
    fireEvent.click(byBookBtn);
    expect(screen.getByText(/Book quote 1/i)).toBeInTheDocument();
  });

  it('allows user to edit note inline and cancel or save', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Editable note quote',
      color: 'amber',
      note: 'Initial note',
    });

    render(<NotebookView />);

    // Click edit note
    const editBtn = screen.getByLabelText('Edit personal reflection');
    fireEvent.click(editBtn);

    const textarea = screen.getByTestId(`edit-note-textarea-${ann.id}`);
    expect(textarea).toHaveValue('Initial note');

    // Cancel edit
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByTestId(`edit-note-textarea-${ann.id}`)).not.toBeInTheDocument();

    // Edit and save
    fireEvent.click(screen.getByLabelText('Edit personal reflection'));
    const textareaAgain = screen.getByTestId(`edit-note-textarea-${ann.id}`);
    fireEvent.change(textareaAgain, { target: { value: 'Updated reflection note' } });

    const saveBtn = screen.getByRole('button', { name: /Save Note/i });
    fireEvent.click(saveBtn);

    expect(screen.getByText('Updated reflection note')).toBeInTheDocument();
    expect(useAnnotationStore.getState().annotations[0].note).toBe('Updated reflection note');
  });

  it('allows copying quote with formatted academic citation', async () => {
    const originalClipboard = navigator.clipboard;
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Famous citation quote',
      color: 'yellow',
    });

    render(<NotebookView />);

    const copyBtn = screen.getByTestId(`copy-citation-btn-${ann.id}`);
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('Famous citation quote')
    );
    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('Jane Austen, Pride and Prejudice')
    );
    expect(screen.getByText('Copied')).toBeInTheDocument();

    Object.assign(navigator, { clipboard: originalClipboard });
  });

  it('navigates directly to the reader when clicking Read Passage', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 2,
      chapterPage: 5,
      selectedText: 'Jump to reader quote',
      color: 'mint',
    });

    render(<NotebookView />);

    const jumpBtn = screen.getByTestId(`jump-reader-btn-${ann.id}`);
    fireEvent.click(jumpBtn);

    expect(mockPush).toHaveBeenCalledWith('/read/1342?chapter=2&page=5');
  });

  it('deletes an individual quote card when delete button is clicked', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'To be deleted quote',
      color: 'rose',
    });

    render(<NotebookView />);
    expect(screen.getByText(/To be deleted quote/i)).toBeInTheDocument();

    const deleteBtn = screen.getByTestId(`delete-quote-btn-${ann.id}`);
    fireEvent.click(deleteBtn);

    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
    expect(screen.queryByText(/To be deleted quote/i)).not.toBeInTheDocument();
  });

  it('clears all annotations when confirming clear everything in modal', async () => {
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Quote 1',
      color: 'yellow',
    });
    await useAnnotationStore.getState().addAnnotation({
      bookId: 84,
      bookTitle: 'Frankenstein',
      bookAuthor: 'Mary Shelley',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Quote 2',
      color: 'mint',
    });

    render(<NotebookView />);
    expect(screen.getByText('Clear All Notes')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear All Notes'));
    expect(screen.getByText('Clear All Saved Notes & Highlights?')).toBeInTheDocument();

    // Confirm clear
    const confirmBtn = screen.getByRole('button', { name: /Clear Everything/i });
    fireEvent.click(confirmBtn);

    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
    expect(screen.getByText('Your Notebook is Empty')).toBeInTheDocument();
  });

  it('cancels clear everything in modal when clicking cancel button', async () => {
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Do not delete me',
      color: 'yellow',
    });

    render(<NotebookView />);
    fireEvent.click(screen.getByText('Clear All Notes'));
    expect(screen.getByText('Clear All Saved Notes & Highlights?')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(useAnnotationStore.getState().annotations).toHaveLength(1);
    expect(screen.getByText(/Do not delete me/i)).toBeInTheDocument();
  });

  it('allows adding a personal note when none was initially provided', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Unannotated passage',
      color: 'amber',
    });

    render(<NotebookView />);

    const addNoteBtn = screen.getByText('Add a personal note...');
    fireEvent.click(addNoteBtn);

    const textarea = screen.getByTestId(`edit-note-textarea-${ann.id}`);
    fireEvent.change(textarea, { target: { value: 'Newly added note' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Note/i }));
    expect(screen.getByText('Newly added note')).toBeInTheDocument();
  });

  it('navigates to reader when volume header title is clicked', async () => {
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Header title quote',
      color: 'rose',
    });

    render(<NotebookView />);

    const headerTitle = screen.getByRole('heading', { name: 'Pride and Prejudice' });
    fireEvent.click(headerTitle);

    expect(mockPush).toHaveBeenCalledWith('/read/1342');
  });

  it('shows reset filters button when search returns 0 results and resets filters', async () => {
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Available passage',
      color: 'yellow',
    });

    render(<NotebookView />);

    const searchInput = screen.getByTestId('notebook-search-input');
    fireEvent.change(searchInput, { target: { value: 'NonExistentTermXYZ' } });

    expect(screen.getByText('No passages match your current search or color filter.')).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /Reset Filters/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText(/Available passage/i)).toBeInTheDocument();
  });

  it('resolves metadata from savedBooks and fallback when bookTitle is not stored', async () => {
    useBookshelfStore.getState().toggleSaveBook({
      id: 9999,
      title: 'Saved Custom Book',
      authors: [{ name: 'Custom Author', birth_year: null, death_year: null }],
      translators: [],
      subjects: [],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 10,
    });

    await useAnnotationStore.getState().addAnnotation({
      bookId: 9999,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Passage from saved book',
      color: 'mint',
    });

    render(<NotebookView />);

    expect(screen.getAllByText('Saved Custom Book').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/by Custom Author/i).length).toBeGreaterThanOrEqual(1);
  });

  it('translates vertical wheel scroll to horizontal scroll on color filter tabs', async () => {
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Wheel test quote',
      color: 'yellow',
    });

    render(<NotebookView />);

    const colorTabs = screen.getByTestId('notebook-color-tabs');
    expect(colorTabs).toBeInTheDocument();

    colorTabs.scrollLeft = 0;

    const wheelDownEvent = new WheelEvent('wheel', {
      deltaY: 120,
      deltaX: 0,
      cancelable: true,
      bubbles: true,
    });
    colorTabs.dispatchEvent(wheelDownEvent);

    expect(colorTabs.scrollLeft).toBe(120);
    expect(wheelDownEvent.defaultPrevented).toBe(true);

    const wheelUpEvent = new WheelEvent('wheel', {
      deltaY: -40,
      deltaX: 0,
      cancelable: true,
      bubbles: true,
    });
    colorTabs.dispatchEvent(wheelUpEvent);

    expect(colorTabs.scrollLeft).toBe(80);
    expect(wheelUpEvent.defaultPrevented).toBe(true);
  });
});

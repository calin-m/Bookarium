import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotebookView } from './NotebookView';
import { useAnnotationStore } from '@/stores/useAnnotationStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

let testQueryClient: QueryClient;

const render = (ui: React.ReactElement, client?: QueryClient) => {
  const queryClient = client || testQueryClient;
  return rtlRender(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('NotebookView component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
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

  it('cleans raw Gutenberg preamble titles and resolves authentic metadata in Notebook', async () => {
    await useAnnotationStore.getState().addAnnotation({
      bookId: 84,
      bookTitle: 'The Project Gutenberg eBook of Frankenstein; Or, The Modern Prometheus',
      bookAuthor: 'Project Gutenberg',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'You seek for knowledge and wisdom, as I once did.',
      color: 'mint',
      note: 'Walton letters',
    });

    render(<NotebookView />);

    expect(screen.queryByText(/The Project Gutenberg eBook of/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Frankenstein; Or, The Modern Prometheus').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/by Mary Wollstonecraft Shelley/i).length).toBeGreaterThanOrEqual(1);
  });

  it('cleans raw preamble titles for non-featured books and falls back gracefully for placeholders', async () => {
    await useAnnotationStore.getState().addAnnotation({
      bookId: 99991,
      bookTitle: 'The Project Gutenberg eBook of The Secret Garden',
      bookAuthor: 'by Frances Hodgson Burnett',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'When Mary Lennox was sent to Misselthwaite Manor...',
      color: 'rose',
      note: 'Opening line',
    });

    await useAnnotationStore.getState().addAnnotation({
      bookId: 99992,
      bookTitle: 'The Project Gutenberg eBook',
      bookAuthor: 'Unknown Author',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Some uncredited text quote',
      color: 'amber',
      note: 'Mystery text',
    });

    render(<NotebookView />);

    expect(screen.getAllByText('The Secret Garden').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/by Frances Hodgson Burnett/i).length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText('Volume #99992').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/by Classic Literature/i).length).toBeGreaterThanOrEqual(1);
  });

  it('resolves authentic title and author for non-featured, non-saved book (e.g. 31635) via remote book query', async () => {
    testQueryClient.setQueryData(
      ['books', { ids: '31635', page: 1, copyright: false }],
      {
        count: 1,
        results: [
          {
            id: 31635,
            title: 'The Silent Barrier',
            authors: [{ name: 'Tracy, Louis', birth_year: 1863, death_year: 1928 }],
            subjects: ['Alps -- Fiction', 'Detective and mystery stories'],
            languages: ['en'],
            copyright: false,
            download_count: 500,
            formats: {},
          },
        ],
      }
    );

    // Add note for book 31635 with NO title and NO author
    await useAnnotationStore.getState().addAnnotation({
      bookId: 31635,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'A silent barrier separated the travelers.',
      color: 'yellow',
      note: 'Key plot clue',
    });

    render(<NotebookView />);

    // Authentically resolved title and natural author
    expect(screen.getAllByText('The Silent Barrier').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/by Louis Tracy/i).length).toBeGreaterThanOrEqual(1);

    // Stored annotation should also be auto-healed in store
    const storeAnn = useAnnotationStore.getState().annotations.find((a) => a.bookId === 31635);
    expect(storeAnn?.bookTitle).toBe('The Silent Barrier');
    expect(storeAnn?.bookAuthor).toBe('Louis Tracy');
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

  it('allows deleting personal reflection via card header with confirmation modal', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Passage with reflection to delete',
      color: 'rose',
      note: 'Deep thoughts on this passage',
    });

    render(<NotebookView />);

    // Reflection is visible
    expect(screen.getByText('Deep thoughts on this passage')).toBeInTheDocument();

    // Click delete personal reflection button
    const deleteReflectionBtn = screen.getByTestId(`delete-reflection-btn-${ann.id}`);
    fireEvent.click(deleteReflectionBtn);

    // Confirmation modal should appear
    const dialog = screen.getByTestId('delete-reflection-dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Delete Personal Reflection?')).toBeInTheDocument();
    expect(screen.getByText(/This will remove only your written personal reflection/i)).toBeInTheDocument();

    // Cancel first
    const cancelBtn = within(dialog).getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByTestId('delete-reflection-dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Deep thoughts on this passage')).toBeInTheDocument();

    // Open modal again and confirm deletion
    fireEvent.click(deleteReflectionBtn);
    const confirmBtn = screen.getByTestId('confirm-delete-reflection-btn');
    fireEvent.click(confirmBtn);

    // Reflection should be gone, but the highlight passage remains intact
    await waitFor(() => {
      expect(screen.queryByText('Deep thoughts on this passage')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Passage with reflection to delete/i)).toBeInTheDocument();
    expect(screen.getByText('Add a personal note...')).toBeInTheDocument();
    expect(useAnnotationStore.getState().annotations[0].note).toBeUndefined();
  });

  it('allows deleting personal reflection from within edit mode toolbar', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Passage edited then deleted',
      color: 'mint',
      note: 'Note to delete from editor',
    });

    render(<NotebookView />);

    // Enter edit mode
    fireEvent.click(screen.getByLabelText('Edit personal reflection'));
    expect(screen.getByTestId(`edit-note-textarea-${ann.id}`)).toBeInTheDocument();

    // Click Delete Note in editor toolbar
    const editorDeleteBtn = screen.getByTestId(`delete-reflection-editor-btn-${ann.id}`);
    fireEvent.click(editorDeleteBtn);

    // Confirmation modal appears
    expect(screen.getByTestId('delete-reflection-dialog')).toBeInTheDocument();

    // Confirm deletion
    fireEvent.click(screen.getByTestId('confirm-delete-reflection-btn'));

    // Should close modal, exit edit mode, and wipe note
    await waitFor(() => {
      expect(screen.queryByTestId('delete-reflection-dialog')).not.toBeInTheDocument();
      expect(screen.queryByTestId(`edit-note-textarea-${ann.id}`)).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Note to delete from editor')).not.toBeInTheDocument();
    expect(screen.getByText(/Passage edited then deleted/i)).toBeInTheDocument();
    expect(screen.getByText('Add a personal note...')).toBeInTheDocument();
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

  it('shows confirmation modal and deletes an individual quote card when confirmed', async () => {
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

    expect(screen.getByTestId('delete-single-note-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Saved Note & Highlight?')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Delete Note/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
    expect(screen.queryByText(/To be deleted quote/i)).not.toBeInTheDocument();
  });

  it('cancels individual quote deletion when clicking cancel in modal', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Kept quote',
      color: 'mint',
    });

    render(<NotebookView />);
    const deleteBtn = screen.getByTestId(`delete-quote-btn-${ann.id}`);
    fireEvent.click(deleteBtn);

    expect(screen.getByTestId('delete-single-note-dialog')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('delete-single-note-dialog')).not.toBeInTheDocument();
    expect(useAnnotationStore.getState().annotations).toHaveLength(1);
    expect(screen.getByText(/Kept quote/i)).toBeInTheDocument();
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

  it('toggles quick color popover and changes highlight color on 1-click swatch', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Quick color quote',
      color: 'yellow',
    });

    render(<NotebookView />);

    // Color popover starts closed
    expect(screen.queryByTestId(`quick-color-popover-${ann.id}`)).not.toBeInTheDocument();

    // Click color badge button
    const badgeBtn = screen.getByTestId(`color-badge-btn-${ann.id}`);
    expect(badgeBtn).toHaveTextContent('yellow');
    fireEvent.click(badgeBtn);

    // Popover is now visible with 4 swatches
    const popover = screen.getByTestId(`quick-color-popover-${ann.id}`);
    expect(popover).toBeInTheDocument();

    // Click Mint swatch
    const mintBtn = screen.getByTestId(`quick-color-btn-${ann.id}-mint`);
    await act(async () => {
      fireEvent.click(mintBtn);
    });

    // Popover closes and badge updates to mint
    expect(screen.queryByTestId(`quick-color-popover-${ann.id}`)).not.toBeInTheDocument();
    expect(badgeBtn).toHaveTextContent('mint');

    // Store is updated
    const updated = useAnnotationStore.getState().annotations.find((a) => a.id === ann.id);
    expect(updated?.color).toBe('mint');
  });

  it('dismisses quick color popover when clicking outside or pressing Escape', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Dismiss test quote',
      color: 'yellow',
    });

    render(<NotebookView />);

    // Open popover
    fireEvent.click(screen.getByTestId(`color-badge-btn-${ann.id}`));
    expect(screen.getByTestId(`quick-color-popover-${ann.id}`)).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId(`quick-color-popover-${ann.id}`)).not.toBeInTheDocument();

    // Open popover again and click outside
    fireEvent.click(screen.getByTestId(`color-badge-btn-${ann.id}`));
    expect(screen.getByTestId(`quick-color-popover-${ann.id}`)).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId(`quick-color-popover-${ann.id}`)).not.toBeInTheDocument();
  });

  it('allows full editing of personal reflection and color via card footer Edit button', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Full edit quote',
      color: 'amber',
      note: 'Initial thought',
    });

    render(<NotebookView />);

    // Click Edit button in card footer
    const editFooterBtn = screen.getByTestId(`edit-quote-btn-${ann.id}`);
    expect(editFooterBtn).toBeInTheDocument();
    fireEvent.click(editFooterBtn);

    // Edit textarea and color swatches appear
    const textarea = screen.getByTestId(`edit-note-textarea-${ann.id}`);
    expect(textarea).toHaveValue('Initial thought');

    // Change note text
    fireEvent.change(textarea, { target: { value: 'Deep literary reflection on pride' } });

    // Change shade to rose
    const roseBtn = screen.getByTestId(`edit-color-btn-${ann.id}-rose`);
    fireEvent.click(roseBtn);

    // Click Save Note
    const saveBtn = screen.getByRole('button', { name: /Save Note/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Verify textarea closes
    expect(screen.queryByTestId(`edit-note-textarea-${ann.id}`)).not.toBeInTheDocument();

    // Verify UI updated
    expect(screen.getByText('Deep literary reflection on pride')).toBeInTheDocument();
    expect(screen.getByTestId(`color-badge-btn-${ann.id}`)).toHaveTextContent('rose');

    // Verify store updated
    const updated = useAnnotationStore.getState().annotations.find((a) => a.id === ann.id);
    expect(updated?.note).toBe('Deep literary reflection on pride');
    expect(updated?.color).toBe('rose');
  });

  it('live-previews selected color during edit mode and reverts if cancelled', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Live preview quote',
      color: 'amber',
      note: 'Draft thought',
    });

    render(<NotebookView />);

    const badgeBtn = screen.getByTestId(`color-badge-btn-${ann.id}`);
    expect(badgeBtn).toHaveTextContent('amber');

    // Enter edit mode
    fireEvent.click(screen.getByTestId(`edit-quote-btn-${ann.id}`));

    // Click mint swatch in edit mode
    const mintBtn = screen.getByTestId(`edit-color-btn-${ann.id}-mint`);
    fireEvent.click(mintBtn);

    // Badge should immediately LIVE PREVIEW as mint even before saving
    expect(badgeBtn).toHaveTextContent('mint');

    // Store is NOT yet updated (still amber)
    expect(useAnnotationStore.getState().annotations.find((a) => a.id === ann.id)?.color).toBe('amber');

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Badge should REVERT back to amber
    expect(badgeBtn).toHaveTextContent('amber');
    expect(useAnnotationStore.getState().annotations.find((a) => a.id === ann.id)?.color).toBe('amber');

    // Enter edit mode again, switch to mint, and Save
    fireEvent.click(screen.getByTestId(`edit-quote-btn-${ann.id}`));
    const newMintBtn = screen.getByTestId(`edit-color-btn-${ann.id}-mint`);
    fireEvent.click(newMintBtn);
    expect(badgeBtn).toHaveTextContent('mint');

    const saveBtn = screen.getByRole('button', { name: /Save Note/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Now permanently mint
    expect(badgeBtn).toHaveTextContent('mint');
    expect(useAnnotationStore.getState().annotations.find((a) => a.id === ann.id)?.color).toBe('mint');
  });
});

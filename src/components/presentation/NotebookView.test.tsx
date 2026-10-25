import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotebookView } from './NotebookView';
import { useAnnotationStore } from '@/stores/useAnnotationStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useJurisdictionStore } from '@/stores/useJurisdictionStore';

let mockNotebookOfflineIds: number[] = [];
vi.mock('@/hooks/useOfflineBooks', () => ({
  useOfflineBooks: () => ({
    offlineBookIds: mockNotebookOfflineIds,
    isBookOffline: (id: number) => mockNotebookOfflineIds.includes(id),
  }),
}));

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
    mockNotebookOfflineIds = [];
    testQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    useAnnotationStore.getState().clearAllAnnotations();
    useAnnotationStore.setState({ fellowAnnotations: [], marginaliaSourceFilter: 'all' });
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

    expect(screen.getByRole('region', { name: /Literary Commonplace Notebook/i })).toHaveClass('py-6', 'sm:py-12');
    expect(screen.getByText('MARGINALIA & REFLECTIONS')).toBeInTheDocument();
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
      ['books', { ids: '31635', page: 1, copyright: false, includeRestrictedMetadata: true }],
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

  it('resolves authentic title, author, and Protected badge for restricted books', async () => {
    useJurisdictionStore.getState().setCountry('GB');

    testQueryClient.setQueryData(
      ['books', { ids: '863', page: 1, copyright: false, includeRestrictedMetadata: true }],
      {
        count: 1,
        results: [
          {
            id: 863,
            title: 'The Mysterious Affair at Styles',
            authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
            subjects: ['Detective and mystery stories'],
            languages: ['en'],
            copyright: false,
            download_count: 1500,
            formats: {},
          },
        ],
      }
    );

    await useAnnotationStore.getState().addAnnotation({
      bookId: 863,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Hastings, my friend, the little grey cells.',
      color: 'amber',
      note: 'Classic deduction',
    });

    render(<NotebookView />);

    expect(screen.getAllByText('The Mysterious Affair at Styles').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/by Agatha Christie/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Protected/i).length).toBeGreaterThanOrEqual(1);

    useJurisdictionStore.getState().resetOverride();
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
    expect(chronoBtn.querySelector('span')).toHaveClass('hidden', 'lg:inline');
    fireEvent.click(chronoBtn);

    expect(screen.getByText(/Book quote 1/i)).toBeInTheDocument();

    const byBookBtn = screen.getByRole('button', { name: /By Book/i });
    expect(byBookBtn.querySelector('span')).toHaveClass('hidden', 'lg:inline');
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
    await act(async () => {
      fireEvent.click(saveBtn);
    });

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
    expect(screen.getByTestId('modal-backdrop')).toHaveClass('bg-transparent', 'backdrop-blur-none');
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

    expect(mockPush).toHaveBeenCalledWith(`/read/1342?chapter=2&page=5&annotationId=${ann.id}`);
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
    expect(screen.getByTestId('modal-backdrop')).toHaveClass('bg-transparent', 'backdrop-blur-none');

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

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save Note/i }));
    });
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

  it('allows click-and-drag grab-to-scroll on notebook color tabs and suppresses accidental filter switch on drag', async () => {
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Yellow quote excerpt',
      color: 'yellow',
    });

    render(<NotebookView />);

    const colorTabs = screen.getByTestId('notebook-color-tabs');
    expect(colorTabs).toHaveClass('cursor-grab', 'select-none');

    colorTabs.scrollLeft = 0;
    const roseFilter = screen.getByTestId('notebook-filter-rose');

    // 1. Mouse down on rose filter pill
    fireEvent.mouseDown(roseFilter, { clientX: 300, button: 0 });

    // 2. Drag by 50px
    fireEvent.mouseMove(window, { clientX: 250 });
    expect(colorTabs.scrollLeft).toBe(50);

    // 3. Mouse up & click
    fireEvent.mouseUp(window, { clientX: 250 });
    fireEvent.click(roseFilter);

    // Filter was NOT triggered by drag release: yellow quote remains visible in 'All'
    expect(screen.getByText(/Yellow quote excerpt/i)).toBeInTheDocument();

    // 4. Normal stationary click on rose filters to empty rose results
    fireEvent.click(roseFilter);
    expect(screen.queryByText(/Yellow quote excerpt/i)).not.toBeInTheDocument();
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

  describe('Copyright and Protected Badge Accuracy in International Jurisdictions', () => {
    afterEach(() => {
      useJurisdictionStore.getState().resetOverride();
    });

    it('does NOT display Protected badge for featured public domain classics in Life+70 jurisdiction (RO)', async () => {
      useJurisdictionStore.setState({
        country: 'RO',
        rule: 'LIFE_70',
        overrideCountry: null,
      });

      await useAnnotationStore.getState().addAnnotation({
        bookId: 1342, // Pride and Prejudice (Jane Austen, 1775-1817)
        bookTitle: 'Pride and Prejudice',
        bookAuthor: 'Jane Austen',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'It is a truth universally acknowledged...',
        color: 'yellow',
        note: 'Classic opening',
      });

      render(<NotebookView />);

      expect(screen.getAllByText('Pride and Prejudice').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/by Jane Austen/i).length).toBeGreaterThanOrEqual(1);

      // Crucial: Jane Austen died in 1817 (> 70 years ago). Must NEVER show Protected badge.
      expect(screen.queryByText(/Protected/i)).not.toBeInTheDocument();
    });

    it('resolves author lifespans from recentBooks without showing Protected badge in Life+70', async () => {
      useJurisdictionStore.setState({
        country: 'RO',
        rule: 'LIFE_70',
        overrideCountry: null,
      });

      // Populate recentBooks in useBookshelfStore
      useBookshelfStore.setState({
        recentBooks: [
          {
            id: 84,
            title: 'Frankenstein; Or, The Modern Prometheus',
            authors: [{ name: 'Shelley, Mary Wollstonecraft', birth_year: 1797, death_year: 1851 }],
            translators: [],
            subjects: [],
            bookshelves: [],
            languages: ['en'],
            copyright: false,
            media_type: 'Text',
            formats: {},
            download_count: 500,
          },
        ],
      });

      await useAnnotationStore.getState().addAnnotation({
        bookId: 84,
        bookTitle: 'Frankenstein',
        bookAuthor: 'Mary Wollstonecraft Shelley',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'I busied myself to think of a story...',
        color: 'mint',
      });

      render(<NotebookView />);

      expect(screen.getAllByText(/Frankenstein/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/Protected/i)).not.toBeInTheDocument();
    });

    it('recovers author lifespans for saved books with incomplete metadata from featured fixtures', async () => {
      useJurisdictionStore.setState({
        country: 'RO',
        rule: 'LIFE_70',
        overrideCountry: null,
      });

      // Simulated incomplete savedBook from legacy cloud sync (null lifespans)
      useBookshelfStore.setState({
        savedBooks: [
          {
            id: 2701, // Moby Dick (Herman Melville, 1819-1891)
            title: 'Moby Dick',
            authors: [{ name: 'Herman Melville', birth_year: null, death_year: null }],
            translators: [],
            subjects: [],
            bookshelves: [],
            languages: ['en'],
            copyright: false,
            media_type: 'Text',
            formats: {},
            download_count: 300,
          },
        ],
      });

      await useAnnotationStore.getState().addAnnotation({
        bookId: 2701,
        bookTitle: 'Moby Dick',
        bookAuthor: 'Herman Melville',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Call me Ishmael.',
        color: 'yellow',
      });

      render(<NotebookView />);

      expect(screen.getAllByText('Moby Dick').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/Protected/i)).not.toBeInTheDocument();
    });

    it('correctly displays Protected badge for truly copyright-restricted authors in foreign jurisdiction', async () => {
      useJurisdictionStore.setState({
        country: 'RO',
        rule: 'LIFE_70',
        overrideCountry: null,
      });

      // Author deceased in 1976 (Agatha Christie) -> protected under Life+70 until 2047
      useBookshelfStore.setState({
        recentBooks: [
          {
            id: 863,
            title: 'The Mysterious Affair at Styles',
            authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
            translators: [],
            subjects: [],
            bookshelves: [],
            languages: ['en'],
            copyright: false,
            media_type: 'Text',
            formats: {},
            download_count: 100,
          },
        ],
      });

      await useAnnotationStore.getState().addAnnotation({
        bookId: 863,
        bookTitle: 'The Mysterious Affair at Styles',
        bookAuthor: 'Agatha Christie',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Hastings, my friend...',
        color: 'rose',
      });

      render(<NotebookView />);

      expect(screen.getAllByText('The Mysterious Affair at Styles').length).toBeGreaterThanOrEqual(1);
      // Should correctly display Protected badge for Agatha Christie under Life+70 in RO
      expect(screen.getAllByText(/Protected/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Sorting and Pagination in NotebookView', () => {
    it('sorts chronological quotes by Date Added Oldest and Newest', async () => {
      const ann1 = await useAnnotationStore.getState().addAnnotation({
        bookId: 1342,
        bookTitle: 'Pride and Prejudice',
        bookAuthor: 'Jane Austen',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'First quote chronologically',
        color: 'yellow',
      });
      useAnnotationStore.setState((state) => ({
        annotations: state.annotations.map((a) =>
          a.id === ann1.id ? { ...a, createdAt: '2025-01-01T10:00:00Z' } : a
        ),
      }));

      const ann2 = await useAnnotationStore.getState().addAnnotation({
        bookId: 84,
        bookTitle: 'Frankenstein',
        bookAuthor: 'Mary Shelley',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Second quote chronologically',
        color: 'mint',
      });
      useAnnotationStore.setState((state) => ({
        annotations: state.annotations.map((a) =>
          a.id === ann2.id ? { ...a, createdAt: '2025-06-01T10:00:00Z' } : a
        ),
      }));

      render(<NotebookView />);

      fireEvent.click(screen.getByRole('button', { name: /Chronological/i }));

      // Default sort is Date Added (Newest) -> ann2 comes first
      const quoteCards = screen.getAllByTestId(/notebook-quote-card-/);
      expect(quoteCards[0]).toHaveTextContent('Second quote chronologically');
      expect(quoteCards[1]).toHaveTextContent('First quote chronologically');

      // Change sort to Date Added (Oldest)
      const sortSelect = screen.getByLabelText('Sort quotes chronologically');
      fireEvent.change(sortSelect, { target: { value: 'date_asc' } });

      const reorderedCards = screen.getAllByTestId(/notebook-quote-card-/);
      expect(reorderedCards[0]).toHaveTextContent('First quote chronologically');
      expect(reorderedCards[1]).toHaveTextContent('Second quote chronologically');
    });

    it('sorts chronological quotes alphabetically by title and author', async () => {
      await useAnnotationStore.getState().addAnnotation({
        bookId: 1342,
        bookTitle: 'Pride and Prejudice',
        bookAuthor: 'Jane Austen',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Pride quote',
        color: 'yellow',
      });
      await useAnnotationStore.getState().addAnnotation({
        bookId: 84,
        bookTitle: 'Frankenstein',
        bookAuthor: 'Mary Shelley',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Frankenstein quote',
        color: 'mint',
      });

      render(<NotebookView />);
      fireEvent.click(screen.getByRole('button', { name: /Chronological/i }));

      const sortSelect = screen.getByLabelText('Sort quotes chronologically');

      // Sort by Title (A -> Z): Frankenstein first
      fireEvent.change(sortSelect, { target: { value: 'title_asc' } });
      let quoteCards = screen.getAllByTestId(/notebook-quote-card-/);
      expect(quoteCards[0]).toHaveTextContent('Frankenstein quote');
      expect(quoteCards[1]).toHaveTextContent('Pride quote');

      // Sort by Author (A -> Z): Jane Austen first
      fireEvent.change(sortSelect, { target: { value: 'author_asc' } });
      quoteCards = screen.getAllByTestId(/notebook-quote-card-/);
      expect(quoteCards[0]).toHaveTextContent('Pride quote');
      expect(quoteCards[1]).toHaveTextContent('Frankenstein quote');
    });

    it('sorts book groups in By-Book mode by Title, Author, and Most Quotes', async () => {
      // Book A: Jane Austen, Pride and Prejudice (1 quote)
      await useAnnotationStore.getState().addAnnotation({
        bookId: 1342,
        bookTitle: 'Pride and Prejudice',
        bookAuthor: 'Jane Austen',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Austen single quote',
        color: 'yellow',
      });

      // Book B: Mary Shelley, Frankenstein (2 quotes)
      await useAnnotationStore.getState().addAnnotation({
        bookId: 84,
        bookTitle: 'Frankenstein',
        bookAuthor: 'Mary Shelley',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Shelley quote 1',
        color: 'mint',
      });
      await useAnnotationStore.getState().addAnnotation({
        bookId: 84,
        bookTitle: 'Frankenstein',
        bookAuthor: 'Mary Shelley',
        chapterIndex: 1,
        chapterPage: 2,
        selectedText: 'Shelley quote 2',
        color: 'mint',
      });

      render(<NotebookView />);
      const getBookHeadings = () =>
        screen.getAllByRole('heading', { level: 2 }).filter((h) => h.textContent !== 'Literary Notebook');

      // In By-Book mode, default sort is Title A -> Z: Frankenstein first
      let headings = getBookHeadings();
      expect(headings[0]).toHaveTextContent('Frankenstein');
      expect(headings[1]).toHaveTextContent('Pride and Prejudice');

      const sortSelect = screen.getByLabelText('Sort book groups');

      // Sort Title Z -> A: Pride and Prejudice first
      fireEvent.change(sortSelect, { target: { value: 'title_desc' } });
      headings = getBookHeadings();
      expect(headings[0]).toHaveTextContent('Pride and Prejudice');
      expect(headings[1]).toHaveTextContent('Frankenstein');

      // Sort Author A -> Z: Jane Austen first
      fireEvent.change(sortSelect, { target: { value: 'author_asc' } });
      headings = getBookHeadings();
      expect(headings[0]).toHaveTextContent('Pride and Prejudice');

      // Sort Author Z -> A: Mary Shelley first
      fireEvent.change(sortSelect, { target: { value: 'author_desc' } });
      headings = getBookHeadings();
      expect(headings[0]).toHaveTextContent('Frankenstein');

      // Sort Most Quotes First: Frankenstein (2 quotes) before Pride and Prejudice (1 quote)
      fireEvent.change(sortSelect, { target: { value: 'count_desc' } });
      headings = getBookHeadings();
      expect(headings[0]).toHaveTextContent('Frankenstein');

      // Sort Downloaded: only volumes cached offline appear
      mockNotebookOfflineIds = [1342];
      fireEvent.change(sortSelect, { target: { value: 'downloaded' } });
      headings = getBookHeadings();
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveTextContent('Pride and Prejudice');
    });

    it('filters quotes to only downloaded books when sorting by Downloaded in chronological mode', async () => {
      mockNotebookOfflineIds = [1342];
      await useAnnotationStore.getState().addAnnotation({
        bookId: 1342,
        bookTitle: 'Pride and Prejudice',
        bookAuthor: 'Jane Austen',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Austen downloaded quote',
        color: 'yellow',
      });
      await useAnnotationStore.getState().addAnnotation({
        bookId: 84,
        bookTitle: 'Frankenstein',
        bookAuthor: 'Mary Shelley',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Shelley online quote',
        color: 'mint',
      });

      render(<NotebookView />);
      fireEvent.click(screen.getByRole('button', { name: /Chronological/i }));

      const sortSelect = screen.getByLabelText('Sort quotes chronologically');
      expect(screen.getAllByTestId(/notebook-quote-card-/)).toHaveLength(2);

      fireEvent.change(sortSelect, { target: { value: 'downloaded' } });
      const cards = screen.getAllByTestId(/notebook-quote-card-/);
      expect(cards).toHaveLength(1);
      expect(cards[0]).toHaveTextContent('Austen downloaded quote');
    });

    it('renders Downloaded empty state and resets filters in volume and chronological modes', async () => {
      mockNotebookOfflineIds = [];
      await useAnnotationStore.getState().addAnnotation({
        bookId: 1342,
        bookTitle: 'Pride and Prejudice',
        bookAuthor: 'Jane Austen',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Austen online quote',
        color: 'yellow',
      });

      render(<NotebookView />);

      // In default volume mode, select 'downloaded' sort
      const volumeSortSelect = screen.getByLabelText('Sort book groups');
      fireEvent.change(volumeSortSelect, { target: { value: 'downloaded' } });

      expect(screen.getByText('No passages from downloaded volumes match your current filter.')).toBeInTheDocument();

      // Click Reset Filters in volume mode
      const resetBtn = screen.getByRole('button', { name: /Reset Filters/i });
      fireEvent.click(resetBtn);

      expect(screen.queryByText('No passages from downloaded volumes match your current filter.')).not.toBeInTheDocument();
      expect(screen.getAllByText('Pride and Prejudice').length).toBeGreaterThanOrEqual(1);
      expect(volumeSortSelect).toHaveValue('title_asc');

      // Switch to Chronological mode and select 'downloaded' sort
      fireEvent.click(screen.getByRole('button', { name: /Chronological/i }));
      const chronoSortSelect = screen.getByLabelText('Sort quotes chronologically');
      fireEvent.change(chronoSortSelect, { target: { value: 'downloaded' } });

      expect(screen.getByText('No passages from downloaded volumes match your current filter.')).toBeInTheDocument();

      const chronoResetBtn = screen.getByRole('button', { name: /Reset Filters/i });
      fireEvent.click(chronoResetBtn);

      expect(screen.queryByText('No passages from downloaded volumes match your current filter.')).not.toBeInTheDocument();
      expect(chronoSortSelect).toHaveValue('date_desc');
    });

    it('paginates chronological quotes with 12 items per page and scrolls to top on page change', () => {
      const scrollToMock = vi.fn();
      window.scrollTo = scrollToMock;
      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      // Seed 15 annotations in a single deterministic batch
      useAnnotationStore.setState({
        annotations: Array.from({ length: 15 }, (_, idx) => {
          const i = idx + 1;
          return {
            id: `chrono-ann-${i}`,
            bookId: 1300 + i,
            bookTitle: 'Pride and Prejudice',
            bookAuthor: 'Jane Austen',
            chapterIndex: 0,
            chapterPage: i,
            selectedText: `Chronological quote sentence #${String(i).padStart(2, '0')}`,
            color: 'yellow' as const,
            createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
            updatedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
          };
        }),
      });

      render(<NotebookView />);
      fireEvent.click(screen.getByRole('button', { name: /Chronological/i }));

      // Should render exactly 12 quote cards on page 1
      const quoteCards = screen.getAllByTestId(/notebook-quote-card-/);
      expect(quoteCards).toHaveLength(12);

      // Top pagination should be visible
      const topPagination = screen.getByRole('navigation', { name: 'Top notebook pagination' });
      expect(topPagination).toBeInTheDocument();
      expect(within(topPagination).getByTestId('top-pagination-indicator')).toHaveTextContent(/1\s*\/\s*2/);

      // Bottom pagination bar should also be visible
      const paginationNav = screen.getByRole('navigation', { name: /Pagination navigation/i });
      expect(paginationNav).toBeInTheDocument();
      expect(within(paginationNav).getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
      expect(within(paginationNav).getByRole('button', { name: 'Go to page 2' })).toBeInTheDocument();

      // Navigate to Page 2 via top pagination Next button
      const nextBtn = within(topPagination).getByRole('button', { name: 'Next page' });
      fireEvent.click(nextBtn);

      // Page 2 should have remaining 3 items
      const page2Cards = screen.getAllByTestId(/notebook-quote-card-/);
      expect(page2Cards).toHaveLength(3);

      // smart scroll should have been called
      expect(scrollToMock).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    });

    it('paginates volume groups with 6 books per page in By-Book mode', () => {
      // Seed 7 annotations across 7 different books in a single batch
      useAnnotationStore.setState({
        annotations: Array.from({ length: 7 }, (_, idx) => {
          const i = idx + 1;
          return {
            id: `vol-ann-${i}`,
            bookId: 1000 + i,
            bookTitle: `Book Volume Title ${String.fromCharCode(65 + i)}`,
            bookAuthor: `Author ${String.fromCharCode(65 + i)}`,
            chapterIndex: 0,
            chapterPage: 1,
            selectedText: `Quote in volume #${String(i).padStart(2, '0')}`,
            color: 'yellow' as const,
            createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
            updatedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
          };
        }),
      });

      render(<NotebookView />);
      const getBookHeadings = () =>
        screen.getAllByRole('heading', { level: 2 }).filter((h) => h.textContent !== 'Literary Notebook');

      // Should render 6 book groups on Page 1
      let headings = getBookHeadings();
      expect(headings).toHaveLength(6);

      // Navigate to Page 2
      const paginationNav = screen.getByRole('navigation', { name: /Pagination navigation/i });
      const nextBtn = within(paginationNav).getByRole('button', { name: 'Go to next page' });
      fireEvent.click(nextBtn);

      // Page 2 should render 1 book group
      headings = getBookHeadings();
      expect(headings).toHaveLength(1);
    });

    it('resets page to 1 when changing search query, color filter, or sort order', () => {
      // Seed 26 annotations (13 mint, 13 rose) across distinct bookIds so initial By-Book render paginates cleanly
      useAnnotationStore.setState({
        annotations: Array.from({ length: 26 }, (_, idx) => {
          const i = idx + 1;
          return {
            id: `reset-ann-${i}`,
            bookId: 2000 + i,
            bookTitle: `Pride and Prejudice Vol ${i}`,
            bookAuthor: 'Jane Austen',
            chapterIndex: 0,
            chapterPage: i,
            selectedText: `Reset page test quote sentence #${String(i).padStart(2, '0')}`,
            color: (i % 2 === 0 ? 'mint' : 'rose') as 'mint' | 'rose',
            createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
            updatedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
          };
        }),
      });

      render(<NotebookView />);
      fireEvent.click(screen.getByRole('button', { name: /Chronological/i }));

      const getPaginationNav = () => screen.getByRole('navigation', { name: /Pagination navigation/i });

      // Navigate to Page 2
      fireEvent.click(within(getPaginationNav()).getByRole('button', { name: 'Go to page 2' }));
      expect(within(getPaginationNav()).getByRole('button', { name: 'Go to page 2' })).toHaveAttribute('aria-current', 'page');

      // Filter by color -> resets to page 1 (13 mint items > 12, so page 1 is active)
      fireEvent.click(screen.getByTestId('notebook-filter-mint'));
      expect(within(getPaginationNav()).getByRole('button', { name: 'Go to page 1' })).toHaveAttribute('aria-current', 'page');

      // Navigate to Page 2 of mint items
      fireEvent.click(within(getPaginationNav()).getByRole('button', { name: 'Go to page 2' }));
      expect(within(getPaginationNav()).getByRole('button', { name: 'Go to page 2' })).toHaveAttribute('aria-current', 'page');

      // Change sort order -> resets to page 1
      const sortSelect = screen.getByLabelText('Sort quotes chronologically');
      fireEvent.change(sortSelect, { target: { value: 'date_asc' } });
      expect(within(getPaginationNav()).getByRole('button', { name: 'Go to page 1' })).toHaveAttribute('aria-current', 'page');
    });

    it('applies tactile animate-page-turn to notebook-content-anchor across grouping, color filter, and pagination transitions', () => {
      useAnnotationStore.setState({
        annotations: Array.from({ length: 30 }, (_, idx) => {
          const i = idx + 1;
          return {
            id: `anim-ann-${i}`,
            bookId: 3000 + i,
            bookTitle: `Frankenstein Vol ${i}`,
            bookAuthor: 'Mary Shelley',
            chapterIndex: 1,
            chapterPage: i,
            selectedText: `Animation test quote #${i}`,
            color: (i % 2 === 0 ? 'mint' : 'rose') as 'mint' | 'rose',
            createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
            updatedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
          };
        }),
      });

      const { container } = render(<NotebookView />);
      const anchor = container.querySelector('#notebook-content-anchor');
      expect(anchor).toBeInTheDocument();
      expect(anchor).toHaveClass('animate-page-turn');

      // Switch to chronological
      fireEvent.click(screen.getByRole('button', { name: /Chronological/i }));
      expect(container.querySelector('#notebook-content-anchor')).toHaveClass('animate-page-turn');

      // Filter by color
      fireEvent.click(screen.getByTestId('notebook-filter-mint'));
      expect(container.querySelector('#notebook-content-anchor')).toHaveClass('animate-page-turn');

      // Paginate to page 2
      const paginationNav = screen.getByRole('navigation', { name: /Pagination navigation/i });
      fireEvent.click(within(paginationNav).getByRole('button', { name: 'Go to page 2' }));
      expect(container.querySelector('#notebook-content-anchor')).toHaveClass('animate-page-turn');
    });

    it('renders source filter pills when fellowAnnotations are present and filters between All, Mine, and Fellows', async () => {
      await useAnnotationStore.getState().addAnnotation({
        bookId: 1342,
        bookTitle: 'Pride and Prejudice',
        bookAuthor: 'Jane Austen',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'My own personal quote',
        color: 'yellow',
        note: 'My note',
      });

      useAnnotationStore.setState({
        fellowAnnotations: [
          {
            id: 'fellow-ann-99',
            bookId: 1342,
            bookTitle: 'Pride and Prejudice',
            bookAuthor: 'Jane Austen',
            chapterIndex: 0,
            chapterPage: 2,
            selectedText: 'Fellow symposium quote',
            color: 'mint',
            note: 'Clara note',
            createdAt: '2026-10-15T10:00:00Z',
            updatedAt: '2026-10-15T10:00:00Z',
            isFellow: true,
            fellowUsername: 'clara_v',
            fellowDisplayName: 'Clara Vance',
          },
        ],
      });

      render(<NotebookView />);

      expect(screen.getByTestId('notebook-source-all')).toBeInTheDocument();
      expect(screen.getByText(/My own personal quote/i)).toBeInTheDocument();
      expect(screen.getByText(/Fellow symposium quote/i)).toBeInTheDocument();

      // Filter by Fellows only
      fireEvent.click(screen.getByTestId('notebook-source-fellows'));
      expect(screen.queryByText(/My own personal quote/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Fellow symposium quote/i)).toBeInTheDocument();

      // Filter by Mine only
      fireEvent.click(screen.getByTestId('notebook-source-mine'));
      expect(screen.getByText(/My own personal quote/i)).toBeInTheDocument();
      expect(screen.queryByText(/Fellow symposium quote/i)).not.toBeInTheDocument();

      // Filter back to All
      fireEvent.click(screen.getByTestId('notebook-source-all'));
      expect(screen.getByText(/My own personal quote/i)).toBeInTheDocument();
      expect(screen.getByText(/Fellow symposium quote/i)).toBeInTheDocument();
    });

    it('merges overlapping own and fellow annotations into a single unified card in All mode', async () => {
      await useAnnotationStore.getState().addAnnotation({
        bookId: 1342,
        bookTitle: 'Pride and Prejudice',
        bookAuthor: 'Jane Austen',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
        color: 'yellow',
        note: 'My reflection on society.',
      });

      useAnnotationStore.setState({
        fellowAnnotations: [
          {
            id: 'fellow-ann-overlap',
            bookId: 1342,
            bookTitle: 'Pride and Prejudice',
            bookAuthor: 'Jane Austen',
            chapterIndex: 0,
            chapterPage: 1,
            selectedText: 'It is a truth universally acknowledged',
            color: 'rose',
            note: 'Clara reflection on marriage.',
            createdAt: '2026-10-15T10:00:00Z',
            updatedAt: '2026-10-15T10:00:00Z',
            isFellow: true,
            fellowUsername: 'clara_v',
            fellowDisplayName: 'Clara Vance',
          },
        ],
      });

      render(<NotebookView />);

      // In All mode: should be merged into 1 card, showing both badges and both reflections
      const cards = screen.getAllByTestId(/^notebook-quote-card-/);
      expect(cards).toHaveLength(1);
      expect(screen.getByTestId('notebook-source-all')).toHaveTextContent('All Marginalia1');
      expect(screen.getByTestId('notebook-fellow-badge-fellow-ann-overlap')).toBeInTheDocument();
      expect(screen.getByText('My reflection on society.')).toBeInTheDocument();
      expect(screen.getByText('Clara reflection on marriage.')).toBeInTheDocument();
      expect(screen.getByTestId('notebook-paired-fellow-note-fellow-ann-overlap')).toBeInTheDocument();

      // In Fellows mode: displays the fellow's standalone card with In My Notes badge and matching reflection
      fireEvent.click(screen.getByTestId('notebook-source-fellows'));
      expect(screen.getAllByTestId(/^notebook-quote-card-/)).toHaveLength(1);
      expect(screen.getByTestId('notebook-fellow-saved-badge-fellow-ann-overlap')).toHaveTextContent('In My Notes');
      expect(screen.getByText('My reflection on society.')).toBeInTheDocument();
      expect(screen.getByText('Clara reflection on marriage.')).toBeInTheDocument();

      // In Mine mode: displays the user's personal card with paired fellow context preserved
      fireEvent.click(screen.getByTestId('notebook-source-mine'));
      expect(screen.getAllByTestId(/^notebook-quote-card-/)).toHaveLength(1);
      expect(screen.getByText('My reflection on society.')).toBeInTheDocument();
      expect(screen.getByText('Clara reflection on marriage.')).toBeInTheDocument();
      expect(screen.getByTestId('notebook-paired-fellow-note-fellow-ann-overlap')).toBeInTheDocument();
    });

    it('matches paired fellow annotation color and fellow details in notebook search and color filters', async () => {
      useAnnotationStore.setState({
        annotations: [
          {
            id: 'own-ann-yellow',
            bookId: 1342,
            bookTitle: 'Pride and Prejudice',
            bookAuthor: 'Jane Austen',
            chapterIndex: 0,
            chapterPage: 1,
            selectedText: 'It is a truth universally acknowledged',
            color: 'yellow',
            note: 'My note on marriage',
            createdAt: '2026-10-10T10:00:00Z',
            updatedAt: '2026-10-10T10:00:00Z',
          },
        ],
        fellowAnnotations: [
          {
            id: 'fellow-ann-rose',
            bookId: 1342,
            bookTitle: 'Pride and Prejudice',
            bookAuthor: 'Jane Austen',
            chapterIndex: 0,
            chapterPage: 1,
            selectedText: 'It is a truth universally acknowledged',
            color: 'rose',
            note: 'Rose reflection by Clara',
            createdAt: '2026-10-12T10:00:00Z',
            updatedAt: '2026-10-12T10:00:00Z',
            isFellow: true,
            fellowUsername: 'claravance',
            fellowDisplayName: 'Clara Vance',
          },
        ],
      });

      render(<NotebookView />);

      // Filter by rose color: own is yellow, but paired fellow is rose -> should match!
      const roseTab = screen.getByTestId('notebook-filter-rose');
      fireEvent.click(roseTab);
      expect(screen.getAllByTestId(/^notebook-quote-card-/)).toHaveLength(1);

      // Reset to all colors
      const allColorsTab = screen.getByTestId('notebook-filter-all');
      fireEvent.click(allColorsTab);

      // Search by fellow username
      const searchInput = screen.getByTestId('notebook-search-input');
      fireEvent.change(searchInput, { target: { value: 'claravance' } });
      expect(screen.getAllByTestId(/^notebook-quote-card-/)).toHaveLength(1);

      // Search by fellow reflection note
      fireEvent.change(searchInput, { target: { value: 'Rose reflection' } });
      expect(screen.getAllByTestId(/^notebook-quote-card-/)).toHaveLength(1);

      // Search non-matching text
      fireEvent.change(searchInput, { target: { value: 'nonexistent query 12345' } });
      expect(screen.queryAllByTestId(/^notebook-quote-card-/)).toHaveLength(0);
    });

    it('allows saving fellow note to own notebook using onSaveFellowAsOwn', async () => {
      useAnnotationStore.setState({
        fellowAnnotations: [
          {
            id: 'fellow-ann-to-save',
            bookId: 1342,
            bookTitle: 'Pride and Prejudice',
            bookAuthor: 'Jane Austen',
            chapterIndex: 0,
            chapterPage: 1,
            selectedText: 'She is tolerable; but not handsome enough to tempt me.',
            color: 'amber',
            note: 'Darcy famous slight.',
            createdAt: '2026-10-15T10:00:00Z',
            updatedAt: '2026-10-15T10:00:00Z',
            isFellow: true,
            fellowUsername: 'clara_v',
            fellowDisplayName: 'Clara Vance',
          },
        ],
        marginaliaSourceFilter: 'fellows',
      });

      render(<NotebookView />);

      const saveBtn = screen.getByTestId('notebook-save-fellow-btn-fellow-ann-to-save');
      expect(saveBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(saveBtn);
      });

      // Verify the annotation was added to own annotations store
      const ownAnnotations = useAnnotationStore.getState().annotations;
      expect(ownAnnotations).toHaveLength(1);
      expect(ownAnnotations[0].selectedText).toBe('She is tolerable; but not handsome enough to tempt me.');
      expect(ownAnnotations[0].bookId).toBe(1342);
    });

    it('resolves metadata for shared fellowAnnotations lacking title/author and primes useReaderStore on Jump to Context', async () => {
      const { useReaderStore } = await import('@/stores/useReaderStore');
      useJurisdictionStore.setState({ country: 'RO' });

      testQueryClient.setQueryData(
        ['books', { ids: '11', page: 1, copyright: false, includeRestrictedMetadata: true }],
        {
          count: 1,
          results: [
            {
              id: 11,
              title: "Alice's Adventures in Wonderland",
              authors: [{ name: 'Carroll, Lewis', birth_year: 1832, death_year: 1898 }],
              subjects: ['Fantasy'],
              languages: ['en'],
              copyright: false,
              download_count: 50000,
              formats: {},
            },
          ],
        }
      );

      useAnnotationStore.setState({
        annotations: [],
        fellowAnnotations: [
          {
            id: 'fellow-alice-11',
            bookId: 11,
            chapterIndex: 2,
            chapterPage: 3,
            selectedText: 'Curiouser and curiouser!',
            color: 'amber',
            note: 'Famous Alice exclamation',
            createdAt: '2026-10-15T10:00:00Z',
            updatedAt: '2026-10-15T10:00:00Z',
            isFellow: true,
            fellowUsername: 'clara_v',
            fellowDisplayName: 'Clara Vance',
          },
        ],
        marginaliaSourceFilter: 'fellows',
      });

      render(<NotebookView />);

      await waitFor(() => {
        expect(screen.getAllByText("Alice's Adventures in Wonderland").length).toBeGreaterThanOrEqual(1);
      });
      expect(screen.getAllByText(/by Lewis Carroll/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/Protected/i)).not.toBeInTheDocument();

      // Click Read Passage on the fellow note card
      const jumpBtn = screen.getByRole('button', { name: /Read Passage/i });
      fireEvent.click(jumpBtn);

      expect(mockPush).toHaveBeenCalledWith('/read/11?chapter=2&page=3&annotationId=fellow-alice-11');
      expect(useReaderStore.getState().currentBook?.id).toBe(11);
      expect((useReaderStore.getState().currentBook as any)?.authors?.[0]?.death_year).toBe(1898);

      act(() => {
        useJurisdictionStore.setState({ country: 'US' });
      });
    });

    it('renders quote cards in a single-column grid on tablet and two-column grid on desktop (lg:grid-cols-2)', async () => {
      await useAnnotationStore.getState().addAnnotation({
        bookId: 1342,
        bookTitle: 'Pride and Prejudice',
        bookAuthor: 'Jane Austen',
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'It is a truth universally acknowledged...',
        color: 'yellow',
        note: 'Opening reflection',
      });

      const { container } = render(<NotebookView />);
      const volumeGrid = container.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2');
      expect(volumeGrid).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Chronological' }));
      const chronoGrid = container.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2');
      expect(chronoGrid).toBeInTheDocument();
    });
  });
});


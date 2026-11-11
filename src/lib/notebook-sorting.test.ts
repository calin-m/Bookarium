import { describe, it, expect } from 'vitest';
import {
  decomposeVolumeSort,
  resolveVolumeSort,
  decomposeChronoSort,
  resolveChronoSort,
  filterNotebookAnnotations,
  groupAnnotationsByVolume,
  sortNotebookAnnotationsChronologically,
  sortNotebookVolumeGroups,
  NOTEBOOK_VOLUME_BASE_SORT_OPTIONS,
  NOTEBOOK_CHRONO_BASE_SORT_OPTIONS,
  type NotebookDisplayItem,
} from './notebook-sorting';

const makeDisplayItem = (
  overrides: Partial<NotebookDisplayItem> = {}
): NotebookDisplayItem => ({
  id: 'ann-1',
  bookId: 1342,
  bookTitle: 'Pride and Prejudice',
  bookAuthor: 'Jane Austen',
  chapterIndex: 0,
  chapterPage: 1,
  selectedText: 'It is a truth universally acknowledged',
  color: 'yellow',
  note: 'Opening reflection',
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z',
  ...overrides,
});

describe('notebook-sorting', () => {
  it('decomposes and resolves volume and chronological sort options', () => {
    expect(NOTEBOOK_VOLUME_BASE_SORT_OPTIONS).toHaveLength(5);
    expect(NOTEBOOK_CHRONO_BASE_SORT_OPTIONS).toHaveLength(4);

    expect(decomposeVolumeSort('title_asc')).toEqual({
      base: 'title',
      dir: 'asc',
      isDirectionDisabled: false,
    });
    expect(decomposeVolumeSort('count_desc')).toEqual({
      base: 'count',
      dir: 'desc',
      isDirectionDisabled: false,
    });
    expect(decomposeVolumeSort('downloaded')).toEqual({
      base: 'downloaded',
      dir: 'desc',
      isDirectionDisabled: true,
    });
    expect(resolveVolumeSort('title', 'desc')).toBe('title_desc');
    expect(resolveVolumeSort('recent', 'asc')).toBe('recent_asc');

    expect(decomposeChronoSort('date_desc')).toEqual({
      base: 'date',
      dir: 'desc',
      isDirectionDisabled: false,
    });
    expect(resolveChronoSort('author', 'asc')).toBe('author_asc');
  });

  it('filters, groups by volume, and sorts notebook annotations chronologically and by volume group', () => {
    const items: NotebookDisplayItem[] = [
      makeDisplayItem({
        id: '1',
        bookId: 1342,
        bookTitle: 'Pride and Prejudice',
        bookAuthor: 'Jane Austen',
        color: 'yellow',
        selectedText: 'universally acknowledged',
        createdAt: '2026-01-02T10:00:00Z',
      }),
      makeDisplayItem({
        id: '2',
        bookId: 84,
        bookTitle: 'Frankenstein',
        bookAuthor: 'Mary Shelley',
        color: 'mint',
        selectedText: 'Beware; for I am fearless',
        note: 'Gothic warning',
        createdAt: '2026-01-01T10:00:00Z',
      }),
    ];

    const resolveDetails = (ann: { bookId: number }) =>
      ann.bookId === 1342
        ? { title: 'Pride and Prejudice', author: 'Jane Austen' }
        : { title: 'Frankenstein', author: 'Mary Shelley' };

    const mintOnly = filterNotebookAnnotations(items, 'mint', '', resolveDetails);
    expect(mintOnly.map((i) => i.id)).toEqual(['2']);

    const queried = filterNotebookAnnotations(
      items,
      'all',
      'Gothic',
      resolveDetails
    );
    expect(queried.map((i) => i.id)).toEqual(['2']);

    const chronoAsc = sortNotebookAnnotationsChronologically(
      items,
      'date_asc',
      resolveDetails,
      (id) => id === 1342
    );
    expect(chronoAsc.map((i) => i.id)).toEqual(['2', '1']);

    const groups = groupAnnotationsByVolume(items, resolveDetails);
    expect(groups).toHaveLength(2);

    const sortedGroupsByTitle = sortNotebookVolumeGroups(
      groups,
      'title_asc',
      (id) => id === 1342
    );
    expect(sortedGroupsByTitle.map((g) => g.title)).toEqual([
      'Frankenstein',
      'Pride and Prejudice',
    ]);
  });
});

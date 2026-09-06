import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncAllStoresWithCloud } from './sync-utils';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useAnnotationStore } from '@/stores/useAnnotationStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useHabitsStore } from '@/stores/useHabitsStore';

describe('syncAllStoresWithCloud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers syncWithCloud concurrently on Bookshelf, Annotation, Reader, and Habits stores', async () => {
    const bookshelfMock = vi.fn().mockResolvedValue(undefined);
    const annotationMock = vi.fn().mockResolvedValue(undefined);
    const readerMock = vi.fn().mockResolvedValue(undefined);
    const habitsMock = vi.fn().mockResolvedValue(undefined);

    useBookshelfStore.setState({ syncWithCloud: bookshelfMock });
    useAnnotationStore.setState({ syncWithCloud: annotationMock });
    useReaderStore.setState({ syncWithCloud: readerMock });
    useHabitsStore.setState({ syncWithCloud: habitsMock });

    await syncAllStoresWithCloud('user-456');

    expect(bookshelfMock).toHaveBeenCalledWith('user-456');
    expect(annotationMock).toHaveBeenCalledWith('user-456');
    expect(readerMock).toHaveBeenCalledWith('user-456');
    expect(habitsMock).toHaveBeenCalledWith('user-456');
  });

  it('safely exits without calling stores if userId is empty', async () => {
    const bookshelfMock = vi.fn().mockResolvedValue(undefined);
    const habitsMock = vi.fn().mockResolvedValue(undefined);
    useBookshelfStore.setState({ syncWithCloud: bookshelfMock });
    useHabitsStore.setState({ syncWithCloud: habitsMock });

    await syncAllStoresWithCloud('');

    expect(bookshelfMock).not.toHaveBeenCalled();
    expect(habitsMock).not.toHaveBeenCalled();
  });

  it('gracefully settles and does not throw if one store encounters a network rejection', async () => {
    const bookshelfMock = vi.fn().mockRejectedValue(new Error('Network error'));
    const annotationMock = vi.fn().mockResolvedValue(undefined);
    const readerMock = vi.fn().mockResolvedValue(undefined);
    const habitsMock = vi.fn().mockResolvedValue(undefined);

    useBookshelfStore.setState({ syncWithCloud: bookshelfMock });
    useAnnotationStore.setState({ syncWithCloud: annotationMock });
    useReaderStore.setState({ syncWithCloud: readerMock });
    useHabitsStore.setState({ syncWithCloud: habitsMock });

    await expect(syncAllStoresWithCloud('user-789')).resolves.toBeUndefined();

    expect(bookshelfMock).toHaveBeenCalledWith('user-789');
    expect(annotationMock).toHaveBeenCalledWith('user-789');
    expect(readerMock).toHaveBeenCalledWith('user-789');
    expect(habitsMock).toHaveBeenCalledWith('user-789');
  });
});


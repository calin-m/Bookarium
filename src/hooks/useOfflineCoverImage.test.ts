import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineCoverImage } from './useOfflineCoverImage';
import { getOfflineBookCover } from '@/lib/offline-storage';

vi.mock('@/lib/offline-storage', () => ({
  getOfflineBookCover: vi.fn(),
}));

describe('useOfflineCoverImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets imageError when not offline or when no cached cover blob exists', async () => {
    const { result } = renderHook(() => useOfflineCoverImage(1342, false));

    expect(result.current.imageError).toBe(false);
    expect(result.current.offlineCoverUrl).toBeNull();

    await act(async () => {
      await result.current.handleImageError();
    });

    expect(result.current.imageError).toBe(true);
    expect(getOfflineBookCover).not.toHaveBeenCalled();
  });

  it('loads a blob URL from IndexedDB when offline cover blob is available and revokes it on unmount', async () => {
    const fakeBlob = new Blob(['cover-bytes'], { type: 'image/jpeg' });
    vi.mocked(getOfflineBookCover).mockResolvedValueOnce(fakeBlob);
    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:offline-cover-1342');
    const revokeObjectURLSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useOfflineCoverImage(1342, true));

    await act(async () => {
      await result.current.handleImageError();
    });

    expect(getOfflineBookCover).toHaveBeenCalledWith(1342);
    expect(result.current.offlineCoverUrl).toBe('blob:offline-cover-1342');
    expect(result.current.imageError).toBe(false);

    unmount();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:offline-cover-1342');

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });
});

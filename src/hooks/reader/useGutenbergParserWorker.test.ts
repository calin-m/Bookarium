import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGutenbergParserWorker } from './useGutenbergParserWorker';

const sampleText = `
*** START OF THE PROJECT GUTENBERG EBOOK TEST ***

CHAPTER I. THE BEGINNING

It was the best of times, it was the worst of times.

CHAPTER II. THE MIDDLE

It was the age of wisdom, it was the age of foolishness.

*** END OF THE PROJECT GUTENBERG EBOOK TEST ***
`;

describe('useGutenbergParserWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty result when contentText is empty or undefined', () => {
    const { result } = renderHook(() => useGutenbergParserWorker('', 18));
    expect(result.current.rawChapters).toEqual([]);
    expect(result.current.chaptersWithPagination).toEqual([]);
    expect(result.current.totalVolumePages).toBe(0);
    expect(result.current.isProcessing).toBe(false);
  });

  it('parses text synchronously via fallback when workerFactory returns null', async () => {
    const { result } = renderHook(() => useGutenbergParserWorker(sampleText, 18, () => null));

    await waitFor(() => {
      expect(result.current.rawChapters.length).toBeGreaterThanOrEqual(2);
      expect(result.current.chaptersWithPagination.length).toBeGreaterThanOrEqual(2);
      expect(result.current.totalVolumePages).toBeGreaterThanOrEqual(2);
      expect(result.current.isProcessing).toBe(false);
    });
  });

  it('dispatches worker postMessage and handles worker response when Worker is available', async () => {
    let messageHandler: ((e: MessageEvent) => void) | null = null;
    const postMessageMock = vi.fn((data: any) => {
      setTimeout(() => {
        messageHandler?.({
          data: {
            id: data.id,
            rawChapters: [{ title: 'Chapter 1', content: 'Content', pageCount: 1 }],
            chaptersWithPagination: [{ title: 'Chapter 1', content: 'Content', pageCount: 1 }],
            totalVolumePages: 1,
          },
        } as MessageEvent);
      }, 0);
    });

    const terminateMock = vi.fn();

    const mockWorker = {
      set onmessage(handler: (e: MessageEvent) => void) {
        messageHandler = handler;
      },
      postMessage: postMessageMock,
      terminate: terminateMock,
    } as unknown as Worker;

    const { result } = renderHook(() =>
      useGutenbergParserWorker(sampleText, 18, () => mockWorker)
    );

    await waitFor(() => {
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          contentText: sampleText,
          fontSize: 18,
        })
      );
      expect(result.current.totalVolumePages).toBe(1);
    });
  });

  it('falls back gracefully when worker encounters an error', async () => {
    let errorHandler: ((e: any) => void) | null = null;
    const postMessageMock = vi.fn(() => {
      setTimeout(() => {
        errorHandler?.(new Error('Worker computation error'));
      }, 0);
    });

    const mockWorker = {
      set onerror(handler: (e: any) => void) {
        errorHandler = handler;
      },
      postMessage: postMessageMock,
      terminate: vi.fn(),
    } as unknown as Worker;

    const { result } = renderHook(() =>
      useGutenbergParserWorker(sampleText, 18, () => mockWorker)
    );

    await waitFor(() => {
      expect(result.current.rawChapters.length).toBeGreaterThanOrEqual(2);
      expect(result.current.isProcessing).toBe(false);
    });
  });

  it('cancels in-flight worker and prevents stale data when switching books', async () => {
    let workerOneInstance: any = null;
    let workerTwoInstance: any = null;
    let factoryCallCount = 0;

    const mockWorkerFactory = () => {
      factoryCallCount++;
      const instance = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null,
        onerror: null,
      };
      if (factoryCallCount === 1) workerOneInstance = instance;
      else workerTwoInstance = instance;
      return instance as unknown as Worker;
    };

    const { rerender } = renderHook(
      ({ text, size }: { text: string; size: number }) =>
        useGutenbergParserWorker(text, size, mockWorkerFactory),
      { initialProps: { text: sampleText, size: 18 } }
    );

    expect(workerOneInstance).not.toBeNull();
    expect(workerOneInstance.postMessage).toHaveBeenCalled();

    // Fast switch to a different book text before worker 1 finishes
    const newBookText = `
*** START OF THE PROJECT GUTENBERG EBOOK BOOK TWO ***
CHAPTER I. BRAND NEW CHAPTER
Something completely different.
*** END OF THE PROJECT GUTENBERG EBOOK BOOK TWO ***
    `;

    rerender({ text: newBookText, size: 18 });

    // Worker 1 must be terminated
    expect(workerOneInstance.terminate).toHaveBeenCalled();
    expect(workerTwoInstance).not.toBeNull();
    expect(workerTwoInstance.postMessage).toHaveBeenCalled();
  });
});

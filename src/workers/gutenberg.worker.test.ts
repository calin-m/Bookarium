import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as gutenbergParser from '@/lib/gutenberg-parser';
import type { GutenbergWorkerInput, GutenbergWorkerOutput } from './gutenberg.worker';
import './gutenberg.worker';

describe('gutenberg.worker Web Worker message handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ignores malformed messages missing id or contentText', () => {
    const postSpy = vi.spyOn(self, 'postMessage').mockImplementation(() => {});

    self.onmessage?.({ data: {} } as MessageEvent<GutenbergWorkerInput>);
    self.onmessage?.({ data: { id: '1342', contentText: '', fontSize: 18 } } as MessageEvent<GutenbergWorkerInput>);
    self.onmessage?.({ data: { id: '', contentText: 'Chapter I', fontSize: 18 } } as MessageEvent<GutenbergWorkerInput>);

    expect(postSpy).not.toHaveBeenCalled();
  });

  it('parses chapters, calculates volume pagination, and posts GutenbergWorkerOutput back to the main thread', () => {
    let postedPayload: GutenbergWorkerOutput | null = null;
    const postSpy = vi.spyOn(self, 'postMessage').mockImplementation((msg: unknown) => {
      postedPayload = msg as GutenbergWorkerOutput;
    });

    const sampleText = [
      'CHAPTER I.',
      '',
      'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
      '',
      'CHAPTER II.',
      '',
      'Mr. Bennet was among the earliest of those who waited on Mr. Bingley.',
    ].join('\n');

    self.onmessage?.({
      data: {
        id: '1342',
        contentText: sampleText,
        fontSize: 0, // exercises `fontSize || 18` default fallback
      },
    } as MessageEvent<GutenbergWorkerInput>);

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postedPayload).not.toBeNull();
    expect(postedPayload!.id).toBe('1342');
    expect(postedPayload!.rawChapters.length).toBeGreaterThanOrEqual(2);
    expect(postedPayload!.chaptersWithPagination.length).toBe(postedPayload!.rawChapters.length);
    expect(postedPayload!.totalVolumePages).toBeGreaterThanOrEqual(2);
  });

  it('catches unexpected parser exceptions non-blockingly without crashing the worker thread', () => {
    const postSpy = vi.spyOn(self, 'postMessage').mockImplementation(() => {});
    vi.spyOn(gutenbergParser, 'parseGutenbergChapters').mockImplementation(() => {
      throw new Error('Synthetic parser failure');
    });

    expect(() => {
      self.onmessage?.({
        data: {
          id: '1342',
          contentText: 'CHAPTER I.\n\nContent',
          fontSize: 18,
        },
      } as MessageEvent<GutenbergWorkerInput>);
    }).not.toThrow();

    expect(postSpy).not.toHaveBeenCalled();
  });
});


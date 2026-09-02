import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReaderSpeech, segmentTextIntoSentences, isNaturalVoice } from './useReaderSpeech';

describe('isNaturalVoice', () => {
  it('returns true for high-definition neural and natural voice names', () => {
    expect(isNaturalVoice({ name: 'Microsoft Jenny Natural (Online)' } as any)).toBe(true);
    expect(isNaturalVoice({ name: 'Google US English' } as any)).toBe(true);
    expect(isNaturalVoice({ name: 'Apple Siri Voice 2' } as any)).toBe(true);
    expect(isNaturalVoice({ name: 'Samantha Enhanced' } as any)).toBe(true);
    expect(isNaturalVoice({ name: 'Neural Voice Engine' } as any)).toBe(true);
    expect(isNaturalVoice({ name: 'Aria Premium' } as any)).toBe(true);
  });

  it('returns false for standard mechanical or missing voice names', () => {
    expect(isNaturalVoice({ name: 'Microsoft David Desktop' } as any)).toBe(false);
    expect(isNaturalVoice({ name: 'espeak-ng' } as any)).toBe(false);
    expect(isNaturalVoice(null as any)).toBe(false);
    expect(isNaturalVoice({} as any)).toBe(false);
  });
});

describe('segmentTextIntoSentences', () => {
  it('splits paragraphs into punctuation-delimited sentences', () => {
    const raw = 'Call me Ishmael. Some years ago—never mind how long precisely—I took to the sea! Did you hear that?';
    const result = segmentTextIntoSentences(raw);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('Call me Ishmael.');
    expect(result[1]).toBe('Some years ago—never mind how long precisely—I took to the sea!');
    expect(result[2]).toBe('Did you hear that?');
  });

  it('handles quotes and dialogue gracefully', () => {
    const raw = '“It is a truth universally acknowledged,” said Mrs. Bennet. “That is all!”';
    const result = segmentTextIntoSentences(raw);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toContain('truth universally acknowledged');
  });

  it('returns empty array for empty or whitespace text', () => {
    expect(segmentTextIntoSentences('')).toEqual([]);
    expect(segmentTextIntoSentences('   \n\n  ')).toEqual([]);
  });
});

describe('useReaderSpeech', () => {
  let mockVoices: SpeechSynthesisVoice[] = [];
  let speakMock: any;
  let cancelMock: any;
  let pauseMock: any;
  let resumeMock: any;
  let lastUtterance: any = null;

  beforeEach(() => {
    vi.useFakeTimers();

    mockVoices = [
      {
        name: 'Microsoft David Desktop',
        lang: 'en-US',
        default: false,
        localService: true,
        voiceURI: 'David',
      } as SpeechSynthesisVoice,
      {
        name: 'Microsoft Jenny Natural (Online)',
        lang: 'en-US',
        default: true,
        localService: false,
        voiceURI: 'Jenny',
      } as SpeechSynthesisVoice,
      {
        name: 'Google Français',
        lang: 'fr-FR',
        default: false,
        localService: false,
        voiceURI: 'French',
      } as SpeechSynthesisVoice,
    ];

    speakMock = vi.fn((utterance) => {
      lastUtterance = utterance;
      if (utterance.onstart) utterance.onstart();
    });
    cancelMock = vi.fn();
    pauseMock = vi.fn();
    resumeMock = vi.fn();

    // Mock SpeechSynthesisUtterance constructor
    class MockUtterance {
      text: string;
      rate: number = 1;
      pitch: number = 1;
      voice: SpeechSynthesisVoice | null = null;
      lang: string = 'en-US';
      onstart: any = null;
      onend: any = null;
      onerror: any = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);

    // Mock window.speechSynthesis
    vi.stubGlobal('speechSynthesis', {
      getVoices: vi.fn(() => mockVoices),
      speak: speakMock,
      cancel: cancelMock,
      pause: pauseMock,
      resume: resumeMock,
      paused: false,
      onvoiceschanged: null,
    });

    // Mock navigator.mediaSession
    vi.stubGlobal('MediaMetadata', class {
      title: string;
      artist: string;
      album: string;
      constructor(opts: any) {
        this.title = opts.title;
        this.artist = opts.artist;
        this.album = opts.album;
      }
    });

    Object.defineProperty(global.navigator, 'mediaSession', {
      value: {
        metadata: null,
        setActionHandler: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('detects Web Speech API support and prioritizes Natural voices', () => {
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'First sentence. Second sentence.',
        language: 'en',
      })
    );

    expect(result.current.isSupported).toBe(true);
    expect(result.current.totalSentences).toBe(2);
    expect(result.current.rate).toBe(1.0);
    // Jenny Natural should be prioritized over David Desktop and non-matching voices
    expect(result.current.selectedVoice?.name).toBe('Microsoft Jenny Natural (Online)');
    expect(result.current.naturalVoices.length).toBe(2);
    expect(result.current.naturalVoices[0].name).toBe('Microsoft Jenny Natural (Online)');
    expect(result.current.naturalVoices[1].name).toBe('Google Français');
    expect(result.current.standardVoices.length).toBe(1);
    expect(result.current.standardVoices[0].name).toBe('Microsoft David Desktop');
    expect(result.current.availableVoices.length).toBe(3);
  });

  it('plays sentences and updates playback state', () => {
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'First sentence. Second sentence.',
        language: 'en',
      })
    );

    act(() => {
      result.current.play();
    });

    expect(result.current.isPlaying).toBe(true);
    expect(result.current.currentSentenceIndex).toBe(0);
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(lastUtterance.text).toBe('First sentence.');
  });

  it('pauses and resumes playback correctly', () => {
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'First sentence. Second sentence.',
        language: 'en',
      })
    );

    act(() => {
      result.current.play();
    });

    act(() => {
      result.current.pause();
    });

    expect(pauseMock).toHaveBeenCalled();
    expect(result.current.isPaused).toBe(true);
    expect(result.current.isPlaying).toBe(false);

    // Mock speech engine being paused
    (window.speechSynthesis as any).paused = true;

    act(() => {
      result.current.resume();
    });

    expect(resumeMock).toHaveBeenCalled();
    expect(result.current.isPaused).toBe(false);
    expect(result.current.isPlaying).toBe(true);
  });

  it('progresses to next sentence on utterance onend', () => {
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'First sentence. Second sentence.',
        language: 'en',
      })
    );

    act(() => {
      result.current.play();
    });

    expect(result.current.currentSentenceIndex).toBe(0);

    // Simulate speech end event
    act(() => {
      if (lastUtterance.onend) lastUtterance.onend();
      vi.advanceTimersByTime(50);
    });

    expect(result.current.currentSentenceIndex).toBe(1);
    expect(lastUtterance.text).toBe('Second sentence.');
  });

  it('triggers onPageComplete callback when all sentences finish', () => {
    const onPageComplete = vi.fn();
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'Single sentence only.',
        onPageComplete,
      })
    );

    act(() => {
      result.current.play();
    });

    act(() => {
      if (lastUtterance.onend) lastUtterance.onend();
      vi.advanceTimersByTime(50);
    });

    expect(onPageComplete).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(false);
  });

  it('supports skipNext and skipPrev navigation', () => {
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'One. Two. Three.',
      })
    );

    act(() => {
      result.current.play();
    });

    expect(result.current.currentSentenceIndex).toBe(0);

    act(() => {
      result.current.skipNext();
    });

    expect(result.current.currentSentenceIndex).toBe(1);

    act(() => {
      result.current.skipPrev();
    });

    expect(result.current.currentSentenceIndex).toBe(0);
  });

  it('allows rate adjustment and voice switching', () => {
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'Voice test sentence.',
      })
    );

    act(() => {
      result.current.setRate(1.5);
    });

    expect(result.current.rate).toBe(1.5);

    act(() => {
      result.current.setVoice('David');
    });

    expect(result.current.selectedVoice?.voiceURI).toBe('David');

    // Voice by object
    act(() => {
      result.current.setVoice(mockVoices[0]);
    });
    expect(result.current.selectedVoice?.voiceURI).toBe('David');
  });

  it('handles utterance onerror correctly', () => {
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'Error test sentence.',
      })
    );

    act(() => {
      result.current.play();
    });

    // Ignored errors (canceled)
    act(() => {
      if (lastUtterance.onerror) lastUtterance.onerror({ error: 'canceled' });
    });
    expect(result.current.isPlaying).toBe(true);

    // Fatal error
    act(() => {
      if (lastUtterance.onerror) lastUtterance.onerror({ error: 'audio-busy' });
    });
    expect(result.current.isPlaying).toBe(false);
  });

  it('handles voiceschanged event and diverse voice scoring keywords', () => {
    const extraVoices: SpeechSynthesisVoice[] = [
      { name: 'Siri Voice 1', lang: 'en-US', default: false, localService: true, voiceURI: 'Siri' } as any,
      { name: 'Neural Voice', lang: 'en-GB', default: false, localService: true, voiceURI: 'Neural' } as any,
      { name: 'Google Enhanced Voice', lang: 'en-AU', default: false, localService: true, voiceURI: 'Enhanced' } as any,
      { name: 'espeak voice', lang: 'en-US', default: false, localService: true, voiceURI: 'espeak' } as any,
    ];

    (window.speechSynthesis.getVoices as any).mockReturnValue(extraVoices);

    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'Voices changed test.',
      })
    );

    act(() => {
      if (window.speechSynthesis.onvoiceschanged) {
        window.speechSynthesis.onvoiceschanged(new Event('voiceschanged'));
      }
    });

    expect(result.current.availableVoices.length).toBe(4);
  });

  it('triggers MediaSession action handlers', () => {
    const actionHandlers: Record<string, () => void> = {};
    (navigator.mediaSession.setActionHandler as any).mockImplementation((action: string, handler: () => void) => {
      actionHandlers[action] = handler;
    });

    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'One. Two. Three.',
      })
    );

    act(() => {
      result.current.play();
    });

    // Test MediaSession action handlers
    act(() => {
      if (actionHandlers.pause) actionHandlers.pause();
    });
    expect(pauseMock).toHaveBeenCalled();

    act(() => {
      if (actionHandlers.play) actionHandlers.play();
    });
    expect(result.current.isPlaying).toBe(true);

    act(() => {
      if (actionHandlers.nexttrack) actionHandlers.nexttrack();
    });
    expect(result.current.currentSentenceIndex).toBe(1);

    act(() => {
      if (actionHandlers.previoustrack) actionHandlers.previoustrack();
    });
    expect(result.current.currentSentenceIndex).toBe(0);

    act(() => {
      if (actionHandlers.stop) actionHandlers.stop();
    });
    expect(result.current.isPlaying).toBe(false);
  });

  it('updates utterance dynamically when setRate or setVoice called while actively playing', () => {
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'Live update sentence.',
      })
    );

    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.setRate(1.25);
    });
    expect(speakMock).toHaveBeenCalled();
    expect(lastUtterance.rate).toBe(1.25);

    act(() => {
      result.current.setVoice('David');
    });
    expect(speakMock).toHaveBeenCalled();
    expect(lastUtterance.voice?.name).toBe('Microsoft David Desktop');
  });

  it('handles fallback when no voices are available', () => {
    (window.speechSynthesis.getVoices as any).mockReturnValue([]);

    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'Fallback voice sentence.',
      })
    );

    act(() => {
      result.current.play();
    });

    expect(speakMock).toHaveBeenCalled();
    expect(lastUtterance.lang).toBe('en');
  });

  it('cleans up and cancels speech upon stop() or unmount', () => {
    const { result, unmount } = renderHook(() =>
      useReaderSpeech({
        text: 'Cleanup test.',
      })
    );

    act(() => {
      result.current.play();
    });

    act(() => {
      result.current.stop();
    });

    expect(cancelMock).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);

    unmount();
    expect(cancelMock).toHaveBeenCalled();
  });

  it('adapts to text change when user flips page while playing and restarts from sentence 0', () => {
    let currentText = 'Page 1 sentence 1. Page 1 sentence 2.';
    const { result, rerender } = renderHook(
      (props) =>
        useReaderSpeech({
          text: props.text,
        }),
      {
        initialProps: { text: currentText },
      }
    );

    act(() => {
      result.current.play();
    });

    expect(result.current.isPlaying).toBe(true);
    expect(lastUtterance.text).toBe('Page 1 sentence 1.');

    // User flips page
    currentText = 'Page 2 sentence 1. Page 2 sentence 2.';
    rerender({ text: currentText });

    expect(result.current.currentSentenceIndex).toBe(0);
    expect(result.current.isPlaying).toBe(true);
    expect(lastUtterance.text).toBe('Page 2 sentence 1.');
  });

  it('triggers onNextPage when skipNext called on the final sentence of current page', () => {
    const onNextPage = vi.fn();
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'Single sentence page.',
        onNextPage,
      })
    );

    act(() => {
      result.current.skipNext();
    });

    expect(onNextPage).toHaveBeenCalledTimes(1);
  });

  it('triggers onPreviousPage when skipPrev called on the first sentence of current page', () => {
    const onPreviousPage = vi.fn();
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'Page sentence one. Page sentence two.',
        onPreviousPage,
      })
    );

    // At sentence 0
    act(() => {
      result.current.skipPrev();
    });

    expect(onPreviousPage).toHaveBeenCalledTimes(1);
  });

  it('respects defaultRate, preferredVoiceURI, and invokes onRateChange and onVoiceChange', () => {
    const onRateChange = vi.fn();
    const onVoiceChange = vi.fn();

    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'Custom preferences sentence.',
        defaultRate: 1.5,
        preferredVoiceURI: 'David',
        onRateChange,
        onVoiceChange,
      })
    );

    expect(result.current.rate).toBe(1.5);
    expect(result.current.selectedVoice?.voiceURI).toBe('David');

    act(() => {
      result.current.setRate(1.25);
    });
    expect(onRateChange).toHaveBeenCalledWith(1.25);

    act(() => {
      result.current.setVoice('Jenny');
    });
    expect(onVoiceChange).toHaveBeenCalledWith('Jenny');
  });
});

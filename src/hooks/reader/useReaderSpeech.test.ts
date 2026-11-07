import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useReaderSpeech,
  segmentTextIntoSentences,
  isNaturalVoice,
  normalizeSpeechLang,
  isVoiceLanguageCompatible,
} from './useReaderSpeech';

describe('speech utilities: isNaturalVoice, language helpers & segmentTextIntoSentences', () => {
  it('returns true for high-definition neural, natural, and voiceURI network voices', () => {
    expect(
      isNaturalVoice({ name: 'Microsoft Jenny Natural (Online)' } as unknown as SpeechSynthesisVoice)
    ).toBe(true);
    expect(isNaturalVoice({ name: 'Google US English' } as unknown as SpeechSynthesisVoice)).toBe(
      true
    );
    expect(isNaturalVoice({ name: 'Apple Siri Voice 2' } as unknown as SpeechSynthesisVoice)).toBe(
      true
    );
    expect(isNaturalVoice({ name: 'Samantha Enhanced' } as unknown as SpeechSynthesisVoice)).toBe(
      true
    );
    expect(isNaturalVoice({ name: 'Neural Voice Engine' } as unknown as SpeechSynthesisVoice)).toBe(
      true
    );
    expect(isNaturalVoice({ name: 'Aria Premium' } as unknown as SpeechSynthesisVoice)).toBe(true);
    expect(
      isNaturalVoice({
        name: 'English (United States)',
        voiceURI: 'en-us-x-sfg-network',
      } as unknown as SpeechSynthesisVoice)
    ).toBe(true);
  });

  it('returns false for standard mechanical or missing voice names and normalizes locales', () => {
    expect(
      isNaturalVoice({ name: 'Microsoft David Desktop' } as unknown as SpeechSynthesisVoice)
    ).toBe(false);
    expect(isNaturalVoice({ name: 'espeak-ng' } as unknown as SpeechSynthesisVoice)).toBe(false);
    expect(isNaturalVoice(null as unknown as SpeechSynthesisVoice)).toBe(false);
    expect(isNaturalVoice({} as unknown as SpeechSynthesisVoice)).toBe(false);
    expect(normalizeSpeechLang('en_GB')).toBe('en-GB');
    expect(
      isVoiceLanguageCompatible({ lang: 'en_GB' } as unknown as SpeechSynthesisVoice, 'en')
    ).toBe(true);
    expect(
      isVoiceLanguageCompatible({ lang: 'fr-FR' } as unknown as SpeechSynthesisVoice, 'en')
    ).toBe(false);
  });

  it('splits paragraphs into punctuation-delimited sentences and handles dialogue and whitespace', () => {
    const raw =
      'Call me Ishmael. Some years ago—never mind how long precisely—I took to the sea! Did you hear that?';
    const result = segmentTextIntoSentences(raw);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('Call me Ishmael.');
    expect(result[1]).toBe('Some years ago—never mind how long precisely—I took to the sea!');
    expect(result[2]).toBe('Did you hear that?');

    const dialogue =
      '“It is a truth universally acknowledged,” said Mrs. Bennet. “That is all!”';
    const dialogueResult = segmentTextIntoSentences(dialogue);
    expect(dialogueResult.length).toBeGreaterThanOrEqual(1);
    expect(dialogueResult[0]).toContain('truth universally acknowledged');

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

  it('detects Web Speech API support, filters voices to match the book language, and prioritizes Natural voices', () => {
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'First sentence. Second sentence.',
        language: 'en',
      })
    );

    expect(result.current.isSupported).toBe(true);
    expect(result.current.totalSentences).toBe(2);
    expect(result.current.rate).toBe(1.0);
    // Jenny Natural (en-US) should be prioritized over David Desktop (en-US), and French (fr-FR) is filtered out for an English book
    expect(result.current.selectedVoice?.name).toBe('Microsoft Jenny Natural (Online)');
    expect(result.current.naturalVoices.length).toBe(1);
    expect(result.current.naturalVoices[0].name).toBe('Microsoft Jenny Natural (Online)');
    expect(result.current.standardVoices.length).toBe(1);
    expect(result.current.standardVoices[0].name).toBe('Microsoft David Desktop');
    expect(result.current.availableVoices.length).toBe(2);
  });

  it('falls back to all device voices when no voice matches the book language and normalizes Android underscore locales', () => {
    mockVoices = [
      {
        name: 'English (United Kingdom)',
        lang: 'en_GB',
        default: true,
        localService: true,
        voiceURI: 'en-gb-x-rjs-network',
      } as SpeechSynthesisVoice,
    ];

    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'Gallia est omnis divisa in partes tres.',
        language: 'la',
      })
    );

    expect(result.current.availableVoices).toHaveLength(1);
    expect(result.current.naturalVoices).toHaveLength(1);
    expect(result.current.selectedVoice?.voiceURI).toBe('en-gb-x-rjs-network');

    act(() => {
      result.current.play();
    });
    expect(lastUtterance.lang).toBe('en-GB');
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

  it('skips empty whitespace sentences when narrating', () => {
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'Valid sentence one.    . Valid sentence two.',
      })
    );

    act(() => {
      result.current.play(1);
    });

    expect(result.current.isPlaying).toBe(true);
  });

  it('clears active inter-sentence delay timeout on stop()', () => {
    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'Sentence one. Sentence two.',
      })
    );

    act(() => {
      result.current.play(0);
    });

    // trigger onend which schedules inter-sentence timeout
    act(() => {
      if (lastUtterance?.onend) {
        lastUtterance.onend();
      }
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentSentenceIndex).toBe(0);
  });

  it('handles Chromium fallback polling timers on mount and text flip during active sentence delay', () => {
    const { result, rerender } = renderHook(
      ({ text }) =>
        useReaderSpeech({
          text,
        }),
      { initialProps: { text: 'Initial sentence one. Initial sentence two.' } }
    );

    // Advance fake timers to execute Chromium fallback mount timers (100ms & 350ms)
    act(() => {
      vi.advanceTimersByTime(400);
    });

    act(() => {
      result.current.play(0);
    });

    // trigger onend to set timeoutRef
    act(() => {
      if (lastUtterance?.onend) {
        lastUtterance.onend();
      }
    });

    // Flip text while inter-sentence delay is active to verify branch 324-325
    rerender({ text: 'Brand new page sentence.' });

    expect(result.current.currentSentenceIndex).toBe(0);
  });

  it('hydrates voices when voices load asynchronously after initial mount (Chromium cold start)', () => {
    const originalGetVoices = window.speechSynthesis.getVoices;
    (window.speechSynthesis as any).getVoices = vi
      .fn()
      .mockReturnValueOnce([]) // useState empty
      .mockReturnValueOnce([]) // useState empty
      .mockReturnValueOnce([]) // useState empty
      .mockReturnValueOnce([]) // useState empty
      .mockReturnValue(mockVoices);

    const { result } = renderHook(() =>
      useReaderSpeech({
        text: 'Async hydration test.',
      })
    );

    act(() => {
      if (window.speechSynthesis.onvoiceschanged) {
        (window.speechSynthesis.onvoiceschanged as any)();
      }
    });

    expect(result.current.availableVoices.length).toBeGreaterThan(0);
    expect(result.current.selectedVoice).not.toBeNull();

    (window.speechSynthesis as any).getVoices = originalGetVoices;
  });
});

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { isNaturalVoice } from '@/lib/speech-utils';

export interface UseReaderSpeechOptions {
  text: string;
  bookTitle?: string;
  bookAuthor?: string;
  language?: string;
  currentPage?: number;
  totalPages?: number;
  defaultRate?: number;
  preferredVoiceURI?: string | null;
  onRateChange?: (rate: number) => void;
  onVoiceChange?: (voiceURI: string | null) => void;
  onPageComplete?: () => void;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
}

export interface UseReaderSpeechReturn {
  isSupported: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  currentSentenceIndex: number;
  totalSentences: number;
  sentences: string[];
  currentSentence: string;
  rate: number;
  availableVoices: SpeechSynthesisVoice[];
  naturalVoices: SpeechSynthesisVoice[];
  standardVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  play: (startIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipNext: () => void;
  skipPrev: () => void;
  setRate: (rate: number) => void;
  setVoice: (voice: SpeechSynthesisVoice | string) => void;
}

/**
 * Cleanly splits text into sentence segments using punctuation boundaries
 * while preserving dialogue quotes and avoiding Chromium timeout issues.
 */
export function segmentTextIntoSentences(rawText: string): string[] {
  if (!rawText || typeof rawText !== 'string') return [];

  // Match sentences ending in punctuation (. ! ?) followed by whitespace or quote boundaries
  const regex = /[^.!?\n]+(?:[.!?]+["'”»]?|\n+|$)/g;
  const matches = rawText.match(regex);

  if (!matches) return [];

  return matches
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0 && !/^[\s\-_=*#~]+$/.test(s));
}

export { isNaturalVoice };

/**
 * Scores a voice based on quality indicators (Neural/Natural/Enhanced)
 * and language compatibility.
 */
function getVoiceQualityScore(voice: SpeechSynthesisVoice, targetLang: string): number {
  let score = 0;
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  const cleanTarget = (targetLang || 'en').toLowerCase().slice(0, 2);

  // Language match priority
  if (lang.startsWith(cleanTarget)) {
    score += 100;
  }

  // Modern Neural / Natural engine prioritization
  if (name.includes('natural') || name.includes('online')) score += 50;
  if (name.includes('neural')) score += 40;
  if (name.includes('enhanced') || name.includes('premium')) score += 30;
  if (name.includes('siri')) score += 25;
  if (name.includes('google')) score += 20;

  // Demote legacy mechanical voices
  if (name.includes('espeak') || name.includes('desktop')) score -= 15;

  return score;
}

/**
 * Headless speech synthesis hook providing offline text-to-speech,
 * sentence-level segmentation, natural voice prioritization, and MediaSession controls.
 */
export function useReaderSpeech({
  text,
  bookTitle = 'Bookarium',
  bookAuthor = 'Public Domain',
  language = 'en',
  currentPage: _currentPage,
  totalPages: _totalPages,
  defaultRate = 1.0,
  preferredVoiceURI,
  onRateChange,
  onVoiceChange,
  onPageComplete,
  onNextPage,
  onPreviousPage,
}: UseReaderSpeechOptions): UseReaderSpeechReturn {
  const [isSupported] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);
  const [rate, setRateState] = useState<number>(defaultRate || 1.0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const raw = window.speechSynthesis.getVoices();
    return [...raw].sort((a, b) => getVoiceQualityScore(b, language) - getVoiceQualityScore(a, language));
  });
  const [naturalVoices, setNaturalVoices] = useState<SpeechSynthesisVoice[]>(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const raw = window.speechSynthesis.getVoices();
    const sorted = [...raw].sort((a, b) => getVoiceQualityScore(b, language) - getVoiceQualityScore(a, language));
    return sorted.filter(isNaturalVoice);
  });
  const [standardVoices, setStandardVoices] = useState<SpeechSynthesisVoice[]>(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const raw = window.speechSynthesis.getVoices();
    const sorted = [...raw].sort((a, b) => getVoiceQualityScore(b, language) - getVoiceQualityScore(a, language));
    return sorted.filter((v) => !isNaturalVoice(v));
  });
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const raw = window.speechSynthesis.getVoices();
    if (raw.length === 0) return null;
    const sorted = [...raw].sort((a, b) => getVoiceQualityScore(b, language) - getVoiceQualityScore(a, language));
    const natural = sorted.filter(isNaturalVoice);
    const preferred = preferredVoiceURI
      ? sorted.find((v) => v.voiceURI === preferredVoiceURI || v.name === preferredVoiceURI)
      : null;
    return preferred || natural[0] || sorted[0] || null;
  });

  // References to track active playback state across asynchronous events
  const sentences = useMemo(() => segmentTextIntoSentences(text), [text]);
  const sentencesRef = useRef<string[]>(sentences);
  const currentIndexRef = useRef<number>(currentSentenceIndex);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const isPausedRef = useRef<boolean>(isPaused);
  const rateRef = useRef<number>(rate);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(selectedVoice);
  const onPageCompleteRef = useRef(onPageComplete);
  const onNextPageRef = useRef(onNextPage);
  const onPreviousPageRef = useRef(onPreviousPage);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speakSentenceRef = useRef<(index: number) => void>(() => {});

  // Keep refs synchronized after render without touching refs during render phase
  useEffect(() => {
    sentencesRef.current = sentences;
    currentIndexRef.current = currentSentenceIndex;
    isPlayingRef.current = isPlaying;
    isPausedRef.current = isPaused;
    rateRef.current = rate;
    selectedVoiceRef.current = selectedVoice;
    onPageCompleteRef.current = onPageComplete;
    onNextPageRef.current = onNextPage;
    onPreviousPageRef.current = onPreviousPage;
  });

  // Populate and score available system voices with quality and language filtering
  const populateVoices = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return;

    // Score and sort all available system voices:
    // Prioritize language compatibility and high-definition neural engines,
    // while keeping all installed system voices accessible (100% parity with Account panel).
    const sorted = [...voices].sort((a, b) => {
      return getVoiceQualityScore(b, language) - getVoiceQualityScore(a, language);
    });

    setAvailableVoices(sorted);

    // Partition into Natural/Neural vs Standard voices
    const natural = sorted.filter(isNaturalVoice);
    const standard = sorted.filter((v) => !isNaturalVoice(v));

    setNaturalVoices(natural);
    setStandardVoices(standard);

    // Pick user preferred voice if available, otherwise highest scoring voice for the current language
    if (!selectedVoiceRef.current) {
      const preferred = preferredVoiceURI
        ? sorted.find((v) => v.voiceURI === preferredVoiceURI || v.name === preferredVoiceURI)
        : null;
      const best = preferred || natural[0] || sorted[0] || null;
      selectedVoiceRef.current = best;
      setSelectedVoice(best);
    }
  }, [language, preferredVoiceURI]);

  useEffect(() => {
    if (!isSupported) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.onvoiceschanged = populateVoices;

    // Asynchronously hydrate voices on mount and fallback polling for Chromium lazy voice loading
    const t0 = setTimeout(populateVoices, 0);
    const t1 = setTimeout(populateVoices, 100);
    const t2 = setTimeout(populateVoices, 350);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isSupported, populateVoices]);

  // Clean stop and silence
  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSentenceIndex(0);
  }, []);

  // Internal speaking function for a single sentence
  const speakSentence = useCallback((index: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const allSentences = sentencesRef.current;

    let targetIndex = index;
    while (targetIndex < allSentences.length && !allSentences[targetIndex]?.trim()) {
      targetIndex++;
    }

    if (targetIndex >= allSentences.length) {
      // Completed all sentences in the active view
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentSentenceIndex(0);
      if (onPageCompleteRef.current) {
        onPageCompleteRef.current();
      }
      return;
    }

    // Cancel any overlapping utterance
    window.speechSynthesis.cancel();

    const sentenceText = allSentences[targetIndex];
    const utterance = new SpeechSynthesisUtterance(sentenceText);
    utterance.rate = rateRef.current;
    utterance.pitch = 1.0;

    // JIT voice resolution: if selectedVoiceRef is missing, populate immediately before speaking
    if (!selectedVoiceRef.current) {
      populateVoices();
    }

    const voiceToUse = selectedVoiceRef.current;
    if (voiceToUse) {
      utterance.voice = voiceToUse;
      utterance.lang = voiceToUse.lang;
    } else {
      utterance.lang = language || 'en-US';
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      setCurrentSentenceIndex(targetIndex);
    };

    utterance.onend = () => {
      if (!isPlayingRef.current || isPausedRef.current) return;

      // Natural micro-pause between sentences
      const delay = 40;
      timeoutRef.current = setTimeout(() => {
        speakSentenceRef.current(targetIndex + 1);
      }, delay);
    };

    utterance.onerror = (e) => {
      // Ignore user-initiated cancellation or interruption
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      setIsPlaying(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [language, populateVoices]);

  useEffect(() => {
    speakSentenceRef.current = speakSentence;
  }, [speakSentence]);

  // Page / Text Change Detection: seamlessly adapts to manual or automatic page flips
  const prevTextRef = useRef(text);
  useEffect(() => {
    if (prevTextRef.current !== text) {
      prevTextRef.current = text;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setCurrentSentenceIndex(0);
      currentIndexRef.current = 0;

      // If user was actively listening when the page flipped, continue narrating new page from sentence 0
      if (isPlayingRef.current) {
        speakSentence(0);
      }
    }
  }, [text, speakSentence]);

  // Public controls
  const play = useCallback((startIndex?: number) => {
    if (!selectedVoiceRef.current) {
      populateVoices();
    }
    const target = startIndex !== undefined ? startIndex : currentIndexRef.current;
    setIsPlaying(true);
    setIsPaused(false);
    speakSentence(target);
  }, [speakSentence, populateVoices]);

  const pause = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
        setIsPlaying(true);
      } else {
        play(currentIndexRef.current);
      }
    }
  }, [play]);

  const skipNext = useCallback(() => {
    const isAtEnd = currentIndexRef.current >= sentencesRef.current.length - 1;
    if (isAtEnd) {
      if (onNextPageRef.current) {
        onNextPageRef.current();
      }
    } else {
      const nextIdx = currentIndexRef.current + 1;
      setCurrentSentenceIndex(nextIdx);
      if (isPlayingRef.current) {
        speakSentence(nextIdx);
      }
    }
  }, [speakSentence]);

  const skipPrev = useCallback(() => {
    const isAtStart = currentIndexRef.current <= 0;
    if (isAtStart) {
      if (onPreviousPageRef.current) {
        onPreviousPageRef.current();
      }
    } else {
      const prevIdx = currentIndexRef.current - 1;
      setCurrentSentenceIndex(prevIdx);
      if (isPlayingRef.current) {
        speakSentence(prevIdx);
      }
    }
  }, [speakSentence]);

  const setRate = useCallback((newRate: number) => {
    rateRef.current = newRate;
    setRateState(newRate);
    if (onRateChange) {
      onRateChange(newRate);
    }
    if (isPlayingRef.current && !isPausedRef.current) {
      // Re-trigger current sentence with updated rate immediately
      speakSentence(currentIndexRef.current);
    }
  }, [speakSentence, onRateChange]);

  const setVoice = useCallback((voiceOrUri: SpeechSynthesisVoice | string) => {
    const nextVoice =
      typeof voiceOrUri === 'string'
        ? availableVoices.find((v) => v.voiceURI === voiceOrUri || v.name === voiceOrUri) || null
        : voiceOrUri;

    if (nextVoice) {
      selectedVoiceRef.current = nextVoice;
      setSelectedVoice(nextVoice);
      if (onVoiceChange) {
        onVoiceChange(nextVoice.voiceURI);
      }
    }

    if (isPlayingRef.current && !isPausedRef.current) {
      // Re-trigger current sentence with updated voice immediately
      speakSentence(currentIndexRef.current);
    }
  }, [availableVoices, speakSentence, onVoiceChange]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // MediaSession Lock Screen & Bluetooth Earbud Integration
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    if (isPlaying || isPaused) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: bookTitle,
        artist: bookAuthor,
        album: 'Bookarium Public Domain Archive',
      });

      navigator.mediaSession.setActionHandler('play', () => resume());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('stop', () => stop());
      navigator.mediaSession.setActionHandler('nexttrack', () => skipNext());
      navigator.mediaSession.setActionHandler('previoustrack', () => skipPrev());
    } else {
      navigator.mediaSession.metadata = null;
    }

    return () => {
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('stop', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
      }
    };
  }, [isPlaying, isPaused, bookTitle, bookAuthor, resume, pause, stop, skipNext, skipPrev]);

  return {
    isSupported,
    isPlaying,
    isPaused,
    currentSentenceIndex,
    totalSentences: sentences.length,
    sentences,
    currentSentence: sentences[currentSentenceIndex] || '',
    rate,
    availableVoices,
    naturalVoices,
    standardVoices,
    selectedVoice,
    play,
    pause,
    resume,
    stop,
    skipNext,
    skipPrev,
    setRate,
    setVoice,
  };
}

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Headphones,
  Gauge,
  X,
} from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { cleanVoiceName } from '@/lib/speech-utils';

export interface ReaderSpeechBarProps {
  isOpen: boolean;
  onClose: () => void;
  isPlaying: boolean;
  isPaused: boolean;
  currentSentenceIndex: number;
  totalSentences: number;
  rate: number;
  availableVoices: SpeechSynthesisVoice[];
  naturalVoices?: SpeechSynthesisVoice[];
  standardVoices?: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkipNext: () => void;
  onSkipPrev: () => void;
  onRateChange: (rate: number) => void;
  onVoiceChange: (voiceURI: string) => void;
  theme?: ReaderTheme;
  bookTitle?: string;
  currentPage?: number;
  totalPages?: number;
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
}

const SPEED_PRESETS = [0.85, 1.0, 1.15, 1.25, 1.5, 2.0] as const;

export const ReaderSpeechBar: React.FC<ReaderSpeechBarProps> = ({
  isOpen,
  onClose,
  isPlaying,
  isPaused,
  currentSentenceIndex,
  totalSentences,
  rate,
  availableVoices,
  naturalVoices = [],
  standardVoices = [],
  selectedVoice,
  onPlay,
  onPause,
  onResume,
  onSkipNext,
  onSkipPrev,
  onRateChange,
  onVoiceChange,
  theme = 'light',
  bookTitle,
  currentPage,
  totalPages,
  isPrevDisabled = false,
  isNextDisabled = false,
}) => {
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const activeTheme = getReaderTheme(theme);

  if (!isOpen) return null;

  const handleTogglePlay = () => {
    if (isPlaying) {
      onPause();
    } else if (isPaused) {
      onResume();
    } else {
      onPlay();
    }
  };

  const progressPercent =
    totalSentences > 0 ? Math.round(((currentSentenceIndex + 1) / totalSentences) * 100) : 0;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_e, info) => {
          if (info.offset.y > 60 || info.velocity.y > 400) {
            onClose();
          }
        }}
        className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] landscape:bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 mx-auto z-50 w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] max-w-xl pointer-events-auto touch-pan-y"
        aria-label="Read Aloud Narration Controls"
        data-testid="reader-speech-bar"
      >
        <div
          className={`${activeTheme.drawerBg} border ${activeTheme.border} shadow-2xl rounded-2xl p-2.5 sm:p-4 space-y-2 sm:space-y-3 backdrop-blur-md`}
        >
          {/* Subtle Mobile Drag-to-Dismiss Handle */}
          <div className="flex justify-center -mt-1 -mb-1 sm:hidden">
            <div className="w-8 h-1 rounded-full bg-stone-300 dark:bg-stone-700 opacity-60" aria-hidden="true" />
          </div>

          {/* Top Metadata Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isPlaying ? 'bg-primary/15 animate-pulse' : 'bg-stone-100 dark:bg-stone-800'
                }`}
              >
                <Headphones className={`w-3.5 h-3.5 ${activeTheme.iconAccent}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-serif font-bold truncate">Read Aloud</span>
                  {currentPage !== undefined && totalPages !== undefined && (
                    <span className={`text-[10px] font-mono ${activeTheme.textMuted}`} data-testid="speech-page-indicator">
                      • Page {currentPage}/{totalPages}
                    </span>
                  )}
                  {totalSentences > 0 && (
                    <span className={`text-[10px] font-mono ${activeTheme.textMuted}`}>
                      • Sentence {currentSentenceIndex + 1} / {totalSentences} ({progressPercent}%)
                    </span>
                  )}
                </div>
                {bookTitle && (
                  <p className={`text-[10px] truncate max-w-[200px] sm:max-w-[280px] ${activeTheme.textMuted}`}>
                    {bookTitle}
                  </p>
                )}
              </div>
            </div>

            {/* Close Button with WCAG Touch Target */}
            <button
              type="button"
              onClick={onClose}
              className={`p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0 ${activeTheme.drawerHover}`}
              aria-label="Close Read Aloud"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Linear Progress Bar */}
          <div className="w-full bg-stone-200 dark:bg-stone-800 h-1 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                theme === 'sepia' ? 'bg-amber-500' : 'bg-primary-600 dark:bg-primary-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Primary Controls Row */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pt-0.5">
            {/* Playback Controls (Skip Prev, Play/Pause, Skip Next) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onSkipPrev}
                disabled={isPrevDisabled && currentSentenceIndex <= 0}
                className={`p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border ${activeTheme.border} ${activeTheme.button} disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all active:scale-95`}
                aria-label="Previous sentence"
                title="Previous sentence"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleTogglePlay}
                className={`px-4 py-2 min-h-[40px] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
                  isPlaying
                    ? `${activeTheme.activePill} border ${theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-500'}`
                    : `${activeTheme.button} border ${activeTheme.border}`
                }`}
                aria-label={isPlaying ? 'Pause narration' : 'Play narration'}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                    <span>{isPaused ? 'Resume' : 'Listen'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onSkipNext}
                disabled={isNextDisabled && currentSentenceIndex >= totalSentences - 1}
                className={`p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border ${activeTheme.border} ${activeTheme.button} disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all active:scale-95`}
                aria-label="Next sentence"
                title="Next sentence"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Voice & Speed Tuning Row */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
              {/* Voice Selector */}
              {availableVoices.length > 0 && (
                <div className="relative max-w-[125px] sm:max-w-[190px]">
                  <select
                    value={selectedVoice?.voiceURI || ''}
                    onChange={(e) => onVoiceChange(e.target.value)}
                    aria-label="Narrator voice"
                    className={`w-full min-h-[40px] py-1.5 pl-2 pr-5 text-[11px] font-mono truncate rounded-lg border ${activeTheme.border} ${activeTheme.pill} focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer`}
                  >
                    {naturalVoices.length > 0 && (
                      <optgroup label="🌟 Natural & Neural">
                        {naturalVoices.map((voice) => (
                          <option key={voice.voiceURI} value={voice.voiceURI}>
                            {cleanVoiceName(voice.name)} ({voice.lang}) ✨
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {standardVoices.length > 0 && (
                      <optgroup label="🔈 Standard Voices">
                        {standardVoices.map((voice) => (
                          <option key={voice.voiceURI} value={voice.voiceURI}>
                            {cleanVoiceName(voice.name)} ({voice.lang})
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {naturalVoices.length === 0 &&
                      standardVoices.length === 0 &&
                      availableVoices.map((voice) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {cleanVoiceName(voice.name)} ({voice.lang})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Speed Preset Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSpeedMenuOpen((prev) => !prev)}
                  className={`px-2.5 py-1.5 min-h-[40px] rounded-lg border text-[11px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    activeTheme.button
                  }`}
                  aria-label={`Speech rate: ${rate}x`}
                  aria-expanded={isSpeedMenuOpen}
                >
                  <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{rate}x</span>
                </button>

                {isSpeedMenuOpen && (
                  <div
                    className={`absolute bottom-full right-0 mb-2 p-1 rounded-xl border ${activeTheme.border} ${activeTheme.drawerBg} shadow-xl flex flex-col gap-0.5 z-50 min-w-[70px] animate-in fade-in zoom-in-95 duration-150`}
                  >
                    {SPEED_PRESETS.map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => {
                          onRateChange(speed);
                          setIsSpeedMenuOpen(false);
                        }}
                        className={`px-2.5 py-1 text-[11px] font-mono rounded-md text-left transition-colors cursor-pointer ${
                          rate === speed
                            ? `${activeTheme.activePill} font-bold`
                            : 'hover:bg-stone-100 dark:hover:bg-stone-800'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};


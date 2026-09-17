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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { cleanVoiceName } from '@/lib/speech-utils';
import type { UseReaderSpeechReturn } from '@/hooks/reader/useReaderSpeech';
import { cn } from '@/lib/utils';

export interface ReaderSpeechBarProps {
  speech?: UseReaderSpeechReturn;
  isOpen: boolean;
  onClose: () => void;
  isDrawerOpen?: boolean;
  isPlaying?: boolean;
  isPaused?: boolean;
  currentSentenceIndex?: number;
  totalSentences?: number;
  rate?: number;
  availableVoices?: SpeechSynthesisVoice[];
  naturalVoices?: SpeechSynthesisVoice[];
  standardVoices?: SpeechSynthesisVoice[];
  selectedVoice?: SpeechSynthesisVoice | null;
  onPlay?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onSkipNext?: () => void;
  onSkipPrev?: () => void;
  onRateChange?: (rate: number) => void;
  onVoiceChange?: (voiceURI: string) => void;
  theme?: ReaderTheme;
  bookTitle?: string;
  currentPage?: number;
  totalPages?: number;
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
}

const SPEED_PRESETS = [0.85, 1.0, 1.15, 1.25, 1.5, 2.0] as const;

export const ReaderSpeechBar: React.FC<ReaderSpeechBarProps> = ({
  speech,
  isOpen,
  onClose,
  isDrawerOpen = false,
  isPlaying = speech?.isPlaying ?? false,
  isPaused = speech?.isPaused ?? false,
  currentSentenceIndex = speech?.currentSentenceIndex ?? 0,
  totalSentences = speech?.totalSentences ?? 0,
  rate = speech?.rate ?? 1.0,
  availableVoices = speech?.availableVoices ?? [],
  naturalVoices = speech?.naturalVoices ?? [],
  standardVoices = speech?.standardVoices ?? [],
  selectedVoice = speech?.selectedVoice ?? null,
  onPlay = () => speech?.play(),
  onPause = () => speech?.pause(),
  onResume = () => speech?.resume(),
  onSkipNext = () => speech?.skipNext(),
  onSkipPrev = () => speech?.skipPrev(),
  onRateChange = (r) => speech?.setRate(r),
  onVoiceChange = (v) => speech?.setVoice(v),
  theme = 'light',
  bookTitle,
  currentPage,
  totalPages,
  isPrevDisabled = false,
  isNextDisabled = false,
}) => {
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isUserMinimized, setIsUserMinimized] = useState(false);
  const [snapPosition, setSnapPosition] = useState<'bottom' | 'center' | 'top'>('bottom');
  const [isThresholdReached, setIsThresholdReached] = useState(false);
  const activeTheme = getReaderTheme(theme);

  if (!isOpen) return null;

  // Context-aware state: drawer opens -> automatically collapses into mini-pill
  const isEffectiveMinimized = isDrawerOpen || isUserMinimized;

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

  // Calculate vertical snap offsets
  const getSnapOffset = () => {
    if (isDrawerOpen) return 0;
    if (typeof window === 'undefined') {
      return snapPosition === 'top' ? -480 : snapPosition === 'center' ? -220 : 0;
    }
    const h = window.innerHeight;
    if (snapPosition === 'top') return -Math.round(Math.min(h * 0.70, 520));
    if (snapPosition === 'center') return -Math.round(Math.min(h * 0.35, 260));
    return 0;
  };

  const dragTopLimit =
    typeof window !== 'undefined' ? -Math.max(window.innerHeight - 180, 200) : -450;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, y: isDrawerOpen ? -20 : 24, scale: 0.98 }}
        animate={{
          opacity: 1,
          y: getSnapOffset(),
          scale: 1,
        }}
        exit={{ opacity: 0, y: isDrawerOpen ? -20 : 24, scale: 0.98 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280, mass: 0.8 }}
        drag="y"
        dragConstraints={{
          top: isDrawerOpen ? 0 : dragTopLimit,
          bottom: 0,
        }}
        dragElastic={{ top: 0.2, bottom: 0.35 }}
        onDrag={(_e, info) => {
          if (isDrawerOpen) {
            setIsThresholdReached(info.offset.y < -40);
            return;
          }
          if (snapPosition === 'bottom') {
            if (isEffectiveMinimized) {
              setIsThresholdReached(info.offset.y > 60);
            } else {
              setIsThresholdReached(info.offset.y > 80);
            }
          } else {
            setIsThresholdReached(false);
          }
        }}
        onDragEnd={(_e, info) => {
          setIsThresholdReached(false);

          if (isDrawerOpen) {
            // When docked at top above drawer, swiping up past threshold dismisses
            if (info.offset.y < -40 || info.velocity.y < -300) {
              onClose();
            }
            return;
          }

          // At bottom resting position: Android-style threshold confirmation gestures
          if (snapPosition === 'bottom') {
            if (isEffectiveMinimized) {
              // In Minimized Mini-Pill: pulling down past 60px dismisses and stops audio
              if (info.offset.y > 60 || info.velocity.y > 400) {
                onClose();
                return;
              }
            } else {
              // In Expanded Card: pulling down past 80px collapses into mini-pill (NEVER closes audio)
              if (info.offset.y > 80 || info.velocity.y > 500) {
                setIsUserMinimized(true);
                return;
              }
            }
          }

          // Evaluate magnetic vertical snapping for top / center / bottom
          const currentY = getSnapOffset() + info.offset.y;
          const h = typeof window !== 'undefined' ? window.innerHeight : 800;
          const centerTarget = -Math.round(Math.min(h * 0.35, 260));
          const topTarget = -Math.round(Math.min(h * 0.70, 520));

          const distBottom = Math.abs(currentY - 0);
          const distCenter = Math.abs(currentY - centerTarget);
          const distTop = Math.abs(currentY - topTarget);

          if (distTop < distCenter && distTop < distBottom) {
            setSnapPosition('top');
          } else if (distCenter < distBottom) {
            setSnapPosition('center');
          } else {
            setSnapPosition('bottom');
          }
        }}
        className={cn(
          'fixed left-0 right-0 mx-auto z-[10001] w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] max-w-xl pointer-events-auto touch-pan-y',
          isDrawerOpen
            ? 'top-[calc(3.75rem+env(safe-area-inset-top,0px))] sm:top-[4.25rem]'
            : 'bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] landscape:bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))]'
        )}
        aria-label="Read Aloud Narration Controls"
        data-testid="reader-speech-bar"
      >
        {isEffectiveMinimized ? (
          /* ========================================================================= */
          /* MINIMIZED MINI-PILL MODE (~44px Floating Audio Capsule)                   */
          /* ========================================================================= */
          <div className="flex flex-col items-center gap-1.5">
            <div
              data-testid="speech-bar-minimized"
              className={cn(
                'w-full flex items-center justify-between gap-2 px-3 py-1.5 sm:py-2 rounded-full border shadow-2xl backdrop-blur-md transition-all duration-200',
                activeTheme.drawerBg,
                activeTheme.border,
                isThresholdReached && 'ring-2 ring-red-500/50 border-red-500/60 shadow-red-500/20'
              )}
            >
              {/* Headphones Icon & Compact Text */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors',
                    isPlaying
                      ? 'bg-primary/15 animate-pulse'
                      : theme === 'sepia'
                      ? 'bg-[#402a1d]'
                      : 'bg-stone-100 dark:bg-stone-800',
                    isThresholdReached && 'bg-red-500/15'
                  )}
                >
                  <Headphones
                    className={cn(
                      'w-3.5 h-3.5',
                      isThresholdReached ? 'text-red-500' : activeTheme.iconAccent
                    )}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-nowrap">
                    <span className="text-xs font-serif font-bold truncate max-w-[100px] sm:max-w-[180px]">
                      {bookTitle || 'Read Aloud'}
                    </span>
                    {totalSentences > 0 && (
                      <span className={cn('text-[10px] font-mono shrink-0', activeTheme.textMuted)}>
                        • {currentSentenceIndex + 1}/{totalSentences} ({progressPercent}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Compact Audio Controls Row */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onSkipPrev}
                  disabled={isPrevDisabled && currentSentenceIndex <= 0}
                  className={cn(
                    'p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg border',
                    activeTheme.border,
                    activeTheme.button,
                    'disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all active:scale-95'
                  )}
                  aria-label="Previous sentence"
                  title="Previous sentence"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className={cn(
                    'px-2.5 py-1.5 min-h-[32px] rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer',
                    isPlaying
                      ? `${activeTheme.activePill} border ${
                          theme === 'sepia'
                            ? 'border-[#f59e0b]'
                            : theme === 'dark'
                            ? 'border-primary-400 bg-primary-950/50 text-primary-300 shadow-xs'
                            : 'border-primary-500'
                        }`
                      : `${activeTheme.button} border ${activeTheme.border}`
                  )}
                  aria-label={isPlaying ? 'Pause narration' : 'Play narration'}
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={onSkipNext}
                  disabled={isNextDisabled && currentSentenceIndex >= totalSentences - 1}
                  className={cn(
                    'p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg border',
                    activeTheme.border,
                    activeTheme.button,
                    'disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all active:scale-95'
                  )}
                  aria-label="Next sentence"
                  title="Next sentence"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>

                {/* Expand to Full Card Button */}
                <button
                  type="button"
                  onClick={() => setIsUserMinimized(false)}
                  className={cn(
                    'p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0',
                    activeTheme.drawerHover
                  )}
                  aria-label="Expand narration controls"
                  title="Expand full narration controls"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    'p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0',
                    activeTheme.drawerHover
                  )}
                  aria-label="Close Read Aloud"
                  title="Close Read Aloud"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Android-style Dismiss Confirmation Cue Badge */}
            <AnimatePresence>
              {isThresholdReached && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center justify-center gap-1.5 px-3 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-[10px] font-mono font-semibold text-red-600 dark:text-red-400 backdrop-blur-xs shadow-xs"
                  data-testid="drag-threshold-cue-close"
                >
                  <X className="w-3 h-3" />
                  <span>Release to stop narration</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* ========================================================================= */
          /* EXPANDED FULL CARD MODE (Default Full Controls & Pitch/Speed)             */
          /* ========================================================================= */
          <div className="flex flex-col items-center gap-1.5">
            <div
              data-testid="speech-bar-expanded"
              className={cn(
                'w-full border shadow-2xl rounded-2xl p-2.5 sm:p-4 space-y-2 sm:space-y-3 backdrop-blur-md transition-all duration-200',
                activeTheme.drawerBg,
                activeTheme.border,
                isThresholdReached && 'ring-2 ring-primary/50 border-primary/60 shadow-primary/20'
              )}
            >
              {/* Drag Handle for Vertical Snapping & Dismiss */}
              <div
                className="flex justify-center -mt-1 -mb-1 py-1 cursor-grab active:cursor-grabbing"
                aria-hidden="true"
              >
                <div
                  className={cn(
                    'w-10 h-1.5 rounded-full transition-all duration-200',
                    isThresholdReached
                      ? 'bg-primary w-14 opacity-100'
                      : 'bg-stone-300 dark:bg-stone-700 opacity-60 hover:opacity-100'
                  )}
                />
              </div>

              {/* Top Metadata Header with Minimize and Close Buttons */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                      isPlaying
                        ? 'bg-primary/15 animate-pulse'
                        : theme === 'sepia'
                        ? 'bg-[#402a1d]'
                        : 'bg-stone-100 dark:bg-stone-800'
                    )}
                  >
                    <Headphones className={cn('w-3.5 h-3.5', activeTheme.iconAccent)} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-serif font-bold truncate">Read Aloud</span>
                      {currentPage !== undefined && totalPages !== undefined && (
                        <span className={cn('text-[10px] font-mono', activeTheme.textMuted)} data-testid="speech-page-indicator">
                          • Page {currentPage}/{totalPages}
                        </span>
                      )}
                      {totalSentences > 0 && (
                        <span className={cn('text-[10px] font-mono', activeTheme.textMuted)}>
                          • Sentence {currentSentenceIndex + 1} / {totalSentences} ({progressPercent}%)
                        </span>
                      )}
                    </div>
                    {bookTitle && (
                      <p className={cn('text-[10px] truncate max-w-[200px] sm:max-w-[280px]', activeTheme.textMuted)}>
                        {bookTitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons: Minimize & Close */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsUserMinimized(true)}
                    className={cn(
                      'p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0',
                      activeTheme.drawerHover
                    )}
                    aria-label="Minimize narration controls"
                    title="Minimize to mini-player"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className={cn(
                      'p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0',
                      activeTheme.drawerHover
                    )}
                    aria-label="Close Read Aloud"
                    title="Close Read Aloud"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Linear Progress Bar */}
              <div
                className={cn(
                  'w-full h-1 rounded-full overflow-hidden',
                  theme === 'sepia' ? 'bg-[#462e22]' : 'bg-stone-200 dark:bg-stone-800'
                )}
              >
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    theme === 'sepia' ? 'bg-amber-500' : 'bg-primary-600 dark:bg-primary-500'
                  )}
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
                    className={cn(
                      'p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border',
                      activeTheme.border,
                      activeTheme.button,
                      'disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all active:scale-95'
                    )}
                    aria-label="Previous sentence"
                    title="Previous sentence"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className={cn(
                      'px-4 py-2 min-h-[40px] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer',
                      isPlaying
                        ? `${activeTheme.activePill} border ${
                            theme === 'sepia'
                              ? 'border-[#f59e0b]'
                              : theme === 'dark'
                              ? 'border-primary-400 bg-primary-950/50 text-primary-300 shadow-xs'
                              : 'border-primary-500'
                          }`
                        : `${activeTheme.button} border ${activeTheme.border}`
                    )}
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
                    className={cn(
                      'p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border',
                      activeTheme.border,
                      activeTheme.button,
                      'disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all active:scale-95'
                    )}
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
                    <div className="relative max-w-[130px] sm:max-w-[190px]">
                      <select
                        value={selectedVoice?.voiceURI || ''}
                        onChange={(e) => onVoiceChange(e.target.value)}
                        aria-label="Narrator voice"
                        style={{ colorScheme: theme === 'light' ? 'light' : 'dark' }}
                        className={cn(
                          'w-full min-h-[40px] py-1.5 pl-2 pr-5 text-base sm:text-[11px] font-mono truncate rounded-lg border focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer max-w-full',
                          activeTheme.border,
                          activeTheme.pill
                        )}
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
                      className={cn(
                        'px-2.5 py-1.5 min-h-[40px] rounded-lg border text-[11px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer',
                        activeTheme.button
                      )}
                      aria-label={`Speech rate: ${rate}x`}
                      aria-expanded={isSpeedMenuOpen}
                    >
                      <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{rate}x</span>
                    </button>

                    {isSpeedMenuOpen && (
                      <div
                        className={cn(
                          'absolute bottom-full right-0 mb-2 p-1 rounded-xl border shadow-xl flex flex-col gap-0.5 z-50 min-w-[70px] animate-in fade-in zoom-in-95 duration-150',
                          activeTheme.border,
                          activeTheme.drawerBg
                        )}
                      >
                        {SPEED_PRESETS.map((speed) => (
                          <button
                            key={speed}
                            type="button"
                            onClick={() => {
                              onRateChange(speed);
                              setIsSpeedMenuOpen(false);
                            }}
                            className={cn(
                              'px-2.5 py-1 text-[11px] font-mono rounded-md text-left transition-colors cursor-pointer',
                              rate === speed
                                ? `${activeTheme.activePill} font-bold`
                                : theme === 'sepia'
                                ? 'hover:bg-[#402a1d]'
                                : 'hover:bg-stone-100 dark:hover:bg-stone-800'
                            )}
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

            {/* Android-style Minimize Confirmation Cue Badge */}
            <AnimatePresence>
              {isThresholdReached && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center justify-center gap-1.5 px-3 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-[10px] font-mono font-semibold text-primary backdrop-blur-xs shadow-xs"
                  data-testid="drag-threshold-cue-minimize"
                >
                  <ChevronDown className="w-3 h-3" />
                  <span>Release to minimize</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.aside>
    </AnimatePresence>
  );
};

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Check,
  Headphones,
  Volume2,
  Square,
  Sparkles,
  BookOpen,
  RotateCcw,
} from 'lucide-react';
import { isNaturalVoice, cleanVoiceName } from '@/lib/speech-utils';

export interface AccountNarrationSubPanelProps {
  isActive: boolean;
  speechRate: number;
  onSpeechRateChange: (rate: number) => void;
  speechVoiceURI: string | null;
  onSpeechVoiceChange: (voiceURI: string | null) => void;
  speechAutoPageAdvance: boolean;
  onSpeechAutoPageAdvanceChange: (enabled: boolean) => void;
  speechHighlightEnabled: boolean;
  onSpeechHighlightEnabledChange: (enabled: boolean) => void;
  onResetSpeechPreferences?: () => void;
}

const SPEED_PRESETS = [0.85, 1.0, 1.15, 1.25, 1.5, 2.0] as const;

export const AccountNarrationSubPanel: React.FC<AccountNarrationSubPanelProps> = ({
  isActive,
  speechRate,
  onSpeechRateChange,
  speechVoiceURI,
  onSpeechVoiceChange,
  speechAutoPageAdvance,
  onSpeechAutoPageAdvanceChange,
  speechHighlightEnabled,
  onSpeechHighlightEnabledChange,
  onResetSpeechPreferences,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setVoices(v);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const naturalVoices = useMemo(() => voices.filter(isNaturalVoice), [voices]);
  const standardVoices = useMemo(() => voices.filter((v) => !isNaturalVoice(v)), [voices]);

  const handleTogglePreview = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isPreviewPlaying) {
      window.speechSynthesis.cancel();
      setIsPreviewPlaying(false);
      return;
    }

    window.speechSynthesis.cancel();
    const sampleText = 'Welcome to Bookarium. Public domain literature, beautifully voiced.';
    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.rate = speechRate;

    if (speechVoiceURI) {
      const matched = voices.find(
        (v) => v.voiceURI === speechVoiceURI || v.name === speechVoiceURI
      );
      if (matched) {
        utterance.voice = matched;
        utterance.lang = matched.lang;
      }
    }

    utterance.onstart = () => setIsPreviewPlaying(true);
    utterance.onend = () => setIsPreviewPlaying(false);
    utterance.onerror = () => setIsPreviewPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      id="preferences-subpanel-narration"
      className={isActive ? 'space-y-4' : 'hidden'}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-border flex items-center justify-center shrink-0">
            <Headphones className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-mono text-foreground font-bold">
              Read-Aloud & Audio Narration
            </h3>
            <p className="text-[11px] text-muted-foreground font-sans">
              Preferences saved here automatically apply whenever you listen to a book.
            </p>
          </div>
        </div>

        {onResetSpeechPreferences && (
          <button
            type="button"
            onClick={onResetSpeechPreferences}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 p-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer shrink-0"
            title="Reset speech settings to defaults"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}
      </div>

      {/* Speed Cadence Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-mono font-bold text-foreground">
            Default Narration Speed
          </label>
          <span className="text-[11px] font-mono text-primary font-bold">
            {speechRate}x {speechRate === 1.0 && '(Baseline)'}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onSpeechRateChange(preset)}
              className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold whitespace-nowrap transition-colors cursor-pointer text-center ${
                speechRate === preset
                  ? 'bg-primary/10 border-primary text-primary shadow-xs'
                  : 'bg-card border-border hover:bg-muted text-muted-foreground'
              }`}
            >
              {preset}x
            </button>
          ))}
        </div>
      </div>

      {/* Preferred Voice Dropdown (Always mounted to eliminate async voice-load CLS) */}
      <div className="space-y-2">
        <label
          htmlFor="preferred-narrator-voice-select"
          className="text-[11px] font-mono font-bold text-foreground block"
        >
          Preferred System Narrator Voice
        </label>

        <select
          id="preferred-narrator-voice-select"
          value={speechVoiceURI || ''}
          onChange={(e) => onSpeechVoiceChange(e.target.value || null)}
          aria-label="Preferred narrator voice"
          className="w-full py-2 px-3 text-base sm:text-xs font-mono rounded-xl border border-border bg-card text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer max-w-full truncate"
        >
          <option value="">✨ Auto-Select Highest Quality Voice (Recommended)</option>
          {naturalVoices.length > 0 && (
            <optgroup label="🌟 Natural & Neural Voices">
              {naturalVoices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {cleanVoiceName(voice.name)} ({voice.lang}) ✨
                </option>
              ))}
            </optgroup>
          )}
          {standardVoices.length > 0 && (
            <optgroup label="🔈 Standard System Voices">
              {standardVoices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {cleanVoiceName(voice.name)} ({voice.lang})
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Reading Assistance Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          onClick={() => onSpeechAutoPageAdvanceChange(!speechAutoPageAdvance)}
          className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all cursor-pointer ${
            speechAutoPageAdvance
              ? 'bg-primary/10 border-primary text-foreground shadow-xs'
              : 'bg-card border-border hover:bg-muted/60 text-muted-foreground'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-mono font-bold text-foreground">
                Auto-Page Advance
              </span>
            </div>
            {speechAutoPageAdvance && <Check className="w-4 h-4 text-primary" />}
          </div>
          <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
            Automatically turns to the next page when narration completes the active page.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSpeechHighlightEnabledChange(!speechHighlightEnabled)}
          className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all cursor-pointer ${
            speechHighlightEnabled
              ? 'bg-primary/10 border-primary text-foreground shadow-xs'
              : 'bg-card border-border hover:bg-muted/60 text-muted-foreground'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-mono font-bold text-foreground">
                Sentence Highlighting
              </span>
            </div>
            {speechHighlightEnabled && <Check className="w-4 h-4 text-primary" />}
          </div>
          <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
            Highlights spoken sentences in real-time with an ambient, theme-aware glow.
          </p>
        </button>
      </div>

      {/* Audio Test Preview Button */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border">
        <button
          type="button"
          onClick={handleTogglePreview}
          className={`px-4 py-2.5 rounded-xl border text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 ${
            isPreviewPlaying
              ? 'bg-primary border-primary text-primary-foreground animate-pulse'
              : 'bg-muted/50 border-border hover:bg-muted text-foreground'
          }`}
          aria-label={isPreviewPlaying ? 'Stop sample' : 'Test voice'}
        >
          {isPreviewPlaying ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Sample</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5" />
              <span>Test Voice ({speechRate}x)</span>
            </>
          )}
        </button>

        <span className="text-[11px] font-mono text-muted-foreground">
          Zero API Keys • Offline-First Web Speech
        </span>
      </div>
    </div>
  );
};


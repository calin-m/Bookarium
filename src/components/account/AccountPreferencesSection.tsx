'use client';

import React, { useState } from 'react';
import {
  Sun,
  Coffee,
  Moon,
  Check,
  Headphones,
  Database,
  Sliders,
} from 'lucide-react';
import type { AppTheme } from '@/stores/useThemeStore';
import {
  downloadLibraryBackupJSON,
  exportLibraryToCSV,
} from '@/lib/library-backup';
import { AccountNarrationSubPanel } from './AccountNarrationSubPanel';
import { AccountPortabilitySubPanel } from './AccountPortabilitySubPanel';

export const exportLibraryData = (type: 'json' | 'csv' = 'json'): string | void => {
  if (type === 'csv') {
    return exportLibraryToCSV();
  }
  return downloadLibraryBackupJSON();
};

export interface AccountPreferencesSectionProps {
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  stickyScrollEnabled: boolean;
  onStickyScrollChange: (enabled: boolean) => void;

  // Read-Aloud & Audio Narration Preferences
  speechRate: number;
  onSpeechRateChange: (rate: number) => void;
  speechVoiceURI: string | null;
  onSpeechVoiceChange: (voiceURI: string | null) => void;
  speechAutoPageAdvance: boolean;
  onSpeechAutoPageAdvanceChange: (enabled: boolean) => void;
  speechHighlightEnabled: boolean;
  onSpeechHighlightEnabledChange: (enabled: boolean) => void;
  onResetSpeechPreferences?: () => void;
  userId?: string;
}

type PreferencesSubTabId = 'appearance' | 'narration' | 'portability';

export const AccountPreferencesSection: React.FC<AccountPreferencesSectionProps> = ({
  theme,
  onThemeChange,
  stickyScrollEnabled,
  onStickyScrollChange,
  speechRate,
  onSpeechRateChange,
  speechVoiceURI,
  onSpeechVoiceChange,
  speechAutoPageAdvance,
  onSpeechAutoPageAdvanceChange,
  speechHighlightEnabled,
  onSpeechHighlightEnabledChange,
  onResetSpeechPreferences,
  userId,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<PreferencesSubTabId>('appearance');

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 lg:p-7 shadow-booksaw space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
          Reading & Navigation Preferences
        </h2>

        {/* Tier-2 Focused Sub-Tabs */}
        <div
          role="tablist"
          aria-label="Preferences sub-sections"
          className="w-full max-w-full min-w-0 overflow-hidden sm:w-auto flex sm:inline-flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border self-start lg:self-auto shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'appearance'}
            aria-label="Appearance & Scroll"
            onClick={() => setActiveSubTab('appearance')}
            className={`flex-1 min-w-0 sm:flex-none justify-center px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-mono font-bold whitespace-nowrap border transition-colors cursor-pointer flex items-center gap-1 sm:gap-1.5 ${
              activeSubTab === 'appearance'
                ? 'bg-card text-primary shadow-xs border-border'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders className="hidden min-[420px]:inline-flex sm:inline-flex w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden truncate">Appearance</span>
            <span className="hidden sm:inline">Appearance & Scroll</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'narration'}
            aria-label="Read-Aloud Studio"
            onClick={() => setActiveSubTab('narration')}
            className={`flex-1 min-w-0 sm:flex-none justify-center px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-mono font-bold whitespace-nowrap border transition-colors cursor-pointer flex items-center gap-1 sm:gap-1.5 ${
              activeSubTab === 'narration'
                ? 'bg-card text-primary shadow-xs border-border'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Headphones className="hidden min-[420px]:inline-flex sm:inline-flex w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden truncate">Read-Aloud</span>
            <span className="hidden sm:inline">Read-Aloud Studio</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'portability'}
            aria-label="Backup & Restore"
            onClick={() => setActiveSubTab('portability')}
            className={`flex-1 min-w-0 sm:flex-none justify-center px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-mono font-bold whitespace-nowrap border transition-colors cursor-pointer flex items-center gap-1 sm:gap-1.5 ${
              activeSubTab === 'portability'
                ? 'bg-card text-primary shadow-xs border-border'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database className="hidden min-[420px]:inline-flex sm:inline-flex w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden truncate">Backups</span>
            <span className="hidden sm:inline">Backup & Restore</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab 1: Appearance & Scroll */}
      <div
        id="preferences-subpanel-appearance"
        className={activeSubTab === 'appearance' ? 'space-y-6' : 'hidden'}
      >
        {/* Theme Atmosphere */}
        <div className="space-y-3">
          <label className="text-xs font-mono text-foreground font-bold block">
            Default Reading Atmosphere & Theme
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => onThemeChange('light')}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-mono font-bold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                theme === 'light'
                  ? 'bg-primary/10 border-primary text-primary shadow-xs'
                  : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Light</span>
            </button>

            <button
              type="button"
              onClick={() => onThemeChange('sepia')}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-mono font-bold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                theme === 'sepia'
                  ? 'bg-amber-500/15 border-amber-500 text-amber-500 dark:text-amber-400 shadow-xs'
                  : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground'
              }`}
            >
              <Coffee className="w-4 h-4 text-amber-700 dark:text-amber-500 shrink-0" />
              <span>Sepia</span>
            </button>

            <button
              type="button"
              onClick={() => onThemeChange('dark')}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-mono font-bold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                theme === 'dark'
                  ? 'bg-primary/10 border-primary text-primary shadow-xs'
                  : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground'
              }`}
            >
              <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Dark</span>
            </button>
          </div>
        </div>

        {/* Navigation Sticky Mode */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <label className="text-xs font-mono text-foreground font-bold block">
              Navigation & Sticky Scroll
            </label>
            <span className="text-[11px] font-mono text-muted-foreground">
              {stickyScrollEnabled ? 'Smart Auto-Hide Active' : 'Always Fixed Active'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onStickyScrollChange(true)}
              className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                stickyScrollEnabled
                  ? 'bg-primary/10 border-primary text-foreground shadow-xs'
                  : 'bg-card border-border hover:bg-muted/60 text-muted-foreground'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-mono font-bold text-foreground">
                  Smart Auto-Hide
                </span>
                {stickyScrollEnabled && <Check className="w-4 h-4 text-primary" />}
              </div>
              <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
                Directional scroll auto-hides headers during browsing and navigation to maximize readable space.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onStickyScrollChange(false)}
              className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                !stickyScrollEnabled
                  ? 'bg-primary/10 border-primary text-foreground shadow-xs'
                  : 'bg-card border-border hover:bg-muted/60 text-muted-foreground'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-mono font-bold text-foreground">Always Fixed</span>
                {!stickyScrollEnabled && <Check className="w-4 h-4 text-primary" />}
              </div>
              <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
                Keeps navigation headers stationary at the top of your screen at all times.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Tab 2: Read-Aloud Studio */}
      <AccountNarrationSubPanel
        isActive={activeSubTab === 'narration'}
        speechRate={speechRate}
        onSpeechRateChange={onSpeechRateChange}
        speechVoiceURI={speechVoiceURI}
        onSpeechVoiceChange={onSpeechVoiceChange}
        speechAutoPageAdvance={speechAutoPageAdvance}
        onSpeechAutoPageAdvanceChange={onSpeechAutoPageAdvanceChange}
        speechHighlightEnabled={speechHighlightEnabled}
        onSpeechHighlightEnabledChange={onSpeechHighlightEnabledChange}
        onResetSpeechPreferences={onResetSpeechPreferences}
      />

      {/* Sub-Tab 3: Library Portability & Backups */}
      <AccountPortabilitySubPanel
        isActive={activeSubTab === 'portability'}
        userId={userId}
      />
    </div>
  );
};

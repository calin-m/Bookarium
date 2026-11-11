'use client';

import React, { useState } from 'react';
import {
  Sun,
  Coffee,
  Moon,
  Check,
  Headphones,
  Sliders,
  BookmarkCheck,
  RotateCcw,
  Undo2,
} from 'lucide-react';
import { READER_FONT_CONFIG } from '@/config/reader-config';
import type { AppTheme } from '@/stores/useThemeStore';
import type {
  ReaderFontFamily,
  ReaderReadingMode,
  ReaderColumnWidth,
} from '@/stores/useReaderStore';
import { EditorialUnderlineTabs } from '@/components/ui/EditorialUnderlineTabs';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { AccountNarrationSubPanel } from './AccountNarrationSubPanel';
import { AccountTypographySubPanel } from './AccountTypographySubPanel';

export interface AccountPreferencesSectionProps {
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  stickyScrollEnabled: boolean;
  onStickyScrollChange: (enabled: boolean) => void;

  // Reader Typography, Layout & Marginalia Defaults
  fontFamily?: ReaderFontFamily;
  onFontFamilyChange?: (family: ReaderFontFamily) => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  lineHeight?: number;
  onLineHeightChange?: (height: number) => void;
  brightness?: number;
  onBrightnessChange?: (brightness: number) => void;
  readingMode?: ReaderReadingMode;
  onReadingModeChange?: (mode: ReaderReadingMode) => void;
  columnWidth?: ReaderColumnWidth;
  onColumnWidthChange?: (width: ReaderColumnWidth) => void;
  spoilerShieldEnabled?: boolean;
  onSpoilerShieldChange?: (enabled: boolean) => void;
  exitBookmarkReminderEnabled?: boolean;
  onExitBookmarkReminderChange?: (enabled: boolean) => void;

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

  // Custom Default Preset & Factory Reset Controls
  hasCustomDefaults?: boolean;
  isAtCustomDefaults?: boolean;
  isAtFactoryDefaults?: boolean;
  onSaveCustomDefaults?: () => void;
  onRevertToCustomDefaults?: () => void;
  onResetToFactoryDefaults?: () => void;
}

type PreferencesSubTabId = 'appearance' | 'narration';

export const AccountPreferencesSection: React.FC<AccountPreferencesSectionProps> = ({
  theme,
  onThemeChange,
  stickyScrollEnabled,
  onStickyScrollChange,
  fontFamily = 'serif',
  onFontFamilyChange = () => {},
  fontSize = READER_FONT_CONFIG.DEFAULT_SIZE,
  onFontSizeChange = () => {},
  lineHeight = READER_FONT_CONFIG.DEFAULT_LINE_HEIGHT,
  onLineHeightChange = () => {},
  brightness = READER_FONT_CONFIG.DEFAULT_BRIGHTNESS,
  onBrightnessChange = () => {},
  readingMode = 'paginated',
  onReadingModeChange = () => {},
  columnWidth = 'wide',
  onColumnWidthChange = () => {},
  spoilerShieldEnabled = true,
  onSpoilerShieldChange = () => {},
  exitBookmarkReminderEnabled = true,
  onExitBookmarkReminderChange,
  speechRate,
  onSpeechRateChange,
  speechVoiceURI,
  onSpeechVoiceChange,
  speechAutoPageAdvance,
  onSpeechAutoPageAdvanceChange,
  speechHighlightEnabled,
  onSpeechHighlightEnabledChange,
  onResetSpeechPreferences,
  hasCustomDefaults = false,
  isAtCustomDefaults = false,
  isAtFactoryDefaults = false,
  onSaveCustomDefaults,
  onRevertToCustomDefaults,
  onResetToFactoryDefaults,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<PreferencesSubTabId>('appearance');
  const [isFactoryResetModalOpen, setIsFactoryResetModalOpen] = useState(false);
  const [savedNoticeVisible, setSavedNoticeVisible] = useState(false);

  const handleSaveCustomPreset = () => {
    onSaveCustomDefaults?.();
    setSavedNoticeVisible(true);
    setTimeout(() => {
      setSavedNoticeVisible(false);
    }, 2200);
  };

  const presetStatusLabel =
    hasCustomDefaults && isAtCustomDefaults
      ? 'My Default Active'
      : isAtFactoryDefaults
        ? 'Factory Defaults'
        : 'Custom Modified';

  return (
    <div className="space-y-4">
      {/* Centered Editorial Underline Sub-Tab Bar (Outside & Above Card) */}
      <EditorialUnderlineTabs<PreferencesSubTabId>
        tabs={[
          {
            id: 'appearance',
            label: 'Appearance & Scroll',
            icon: <Sliders className="w-3.5 h-3.5 shrink-0" />,
          },
          {
            id: 'narration',
            label: 'Read-Aloud Studio',
            icon: <Headphones className="w-3.5 h-3.5 shrink-0" />,
          },
        ]}
        activeTab={activeSubTab}
        onSelectTab={setActiveSubTab}
        ariaLabel="Preferences sub-sections"
      />

      {/* Main Preferences Card */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 lg:p-7 shadow-booksaw space-y-6">
        {/* Header & Two-Tier Preset / Factory Reset Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
              Reading & Navigation Preferences
            </h2>
            <span
              data-testid="preferences-preset-status"
              className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border border-border bg-muted/50 text-foreground"
            >
              {presetStatusLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onSaveCustomDefaults && (
              <button
                type="button"
                data-testid="save-custom-defaults-btn"
                onClick={handleSaveCustomPreset}
                disabled={hasCustomDefaults && isAtCustomDefaults && !savedNoticeVisible}
                className="px-2.5 py-1.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-[11px] font-mono font-bold text-primary flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
              >
                <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {savedNoticeVisible
                    ? 'Saved as Default!'
                    : hasCustomDefaults && isAtCustomDefaults
                      ? 'Saved as My Default'
                      : 'Save as My Default'}
                </span>
              </button>
            )}

            {hasCustomDefaults && onRevertToCustomDefaults && (
              <button
                type="button"
                data-testid="revert-custom-defaults-btn"
                onClick={onRevertToCustomDefaults}
                disabled={isAtCustomDefaults}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-[11px] font-mono font-bold text-foreground flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
              >
                <Undo2 className="w-3.5 h-3.5 shrink-0" />
                <span>Revert to My Default</span>
              </button>
            )}

            {onResetToFactoryDefaults && (
              <button
                type="button"
                data-testid="reset-factory-defaults-btn"
                onClick={() => setIsFactoryResetModalOpen(true)}
                disabled={isAtFactoryDefaults && !hasCustomDefaults}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted text-[11px] font-mono font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
              >
                <RotateCcw className="w-3 h-3 shrink-0" />
                <span>Factory Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-Tab 1: Appearance, Typography & Scroll */}
        <div
          id="preferences-subpanel-appearance"
          className={activeSubTab === 'appearance' ? 'space-y-6 animate-in fade-in duration-150' : 'hidden'}
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

          {/* Reader Typography, Layout & Marginalia Defaults */}
          <AccountTypographySubPanel
            theme={theme}
            fontFamily={fontFamily}
            onFontFamilyChange={onFontFamilyChange}
            fontSize={fontSize}
            onFontSizeChange={onFontSizeChange}
            lineHeight={lineHeight}
            onLineHeightChange={onLineHeightChange}
            brightness={brightness}
            onBrightnessChange={onBrightnessChange}
            readingMode={readingMode}
            onReadingModeChange={onReadingModeChange}
            columnWidth={columnWidth}
            onColumnWidthChange={onColumnWidthChange}
            spoilerShieldEnabled={spoilerShieldEnabled}
            onSpoilerShieldChange={onSpoilerShieldChange}
            exitBookmarkReminderEnabled={exitBookmarkReminderEnabled}
            onExitBookmarkReminderChange={onExitBookmarkReminderChange}
          />
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

        <ConfirmActionModal
          isOpen={isFactoryResetModalOpen}
          onClose={() => setIsFactoryResetModalOpen(false)}
          onConfirm={() => {
            setIsFactoryResetModalOpen(false);
            onResetToFactoryDefaults?.();
          }}
          title="Reset All Preferences"
          heading="Reset all reading & navigation preferences to factory defaults?"
          description="This will restore Bookarium's original defaults (Light theme, Serif 18px, 1.75x line spacing, 100% brightness, Paged flow, Wide column, Smart Auto-Hide, Spoiler Shield On, and 1x speech settings)."
          confirmLabel="Reset to Factory Defaults"
          icon={<RotateCcw className="w-5 h-5" />}
          modalTestId="reset-factory-preferences-modal"
          dialogTestId="reset-factory-preferences-dialog"
          cancelTestId="cancel-reset-factory-preferences-btn"
          confirmTestId="confirm-reset-factory-preferences-btn"
        />
      </div>
    </div>
  );
};

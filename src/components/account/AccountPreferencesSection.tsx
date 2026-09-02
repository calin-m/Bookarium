'use client';

import React from 'react';
import { Sun, Coffee, Moon, Check } from 'lucide-react';
import type { AppTheme } from '@/stores/useThemeStore';

export interface AccountPreferencesSectionProps {
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  stickyScrollEnabled: boolean;
  onStickyScrollChange: (enabled: boolean) => void;
}

export const AccountPreferencesSection: React.FC<AccountPreferencesSectionProps> = ({
  theme,
  onThemeChange,
  stickyScrollEnabled,
  onStickyScrollChange,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-booksaw space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
          Reading & Navigation Preferences
        </h2>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-mono text-foreground font-bold block">
          Default Reading Atmosphere & Theme
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => onThemeChange('light')}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              theme === 'light'
                ? 'bg-primary/10 border-primary text-primary shadow-xs'
                : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => onThemeChange('sepia')}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              theme === 'sepia'
                ? 'bg-amber-500/15 border-amber-500 text-amber-500 dark:text-amber-400 shadow-xs'
                : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground'
            }`}
          >
            <Coffee className="w-4 h-4 text-amber-700 dark:text-amber-500" />
            <span>Sepia</span>
          </button>

          <button
            type="button"
            onClick={() => onThemeChange('dark')}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              theme === 'dark'
                ? 'bg-primary/10 border-primary text-primary shadow-xs'
                : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground'
            }`}
          >
            <Moon className="w-4 h-4 text-indigo-400" />
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
            className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              stickyScrollEnabled
                ? 'bg-primary/10 border-primary text-foreground shadow-xs'
                : 'bg-card border-border hover:bg-muted/60 text-muted-foreground'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-mono font-bold text-foreground">Smart Auto-Hide</span>
              {stickyScrollEnabled && <Check className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
              Directional scroll auto-hides headers during browsing and navigation to maximize readable space.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onStickyScrollChange(false)}
            className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
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
  );
};


'use client';

import React from 'react';
import { Sun, Coffee, Moon, Check } from 'lucide-react';
import type { AppTheme } from '@/stores/useThemeStore';

export interface ProfilePreferencesSectionProps {
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  stickyScrollEnabled: boolean;
  onStickyScrollChange: (enabled: boolean) => void;
}

export const ProfilePreferencesSection: React.FC<ProfilePreferencesSectionProps> = ({
  theme,
  onThemeChange,
  stickyScrollEnabled,
  onStickyScrollChange,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
      <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
        Reading & Navigation Preferences
      </h2>

      <div className="space-y-3">
        <label className="text-xs font-mono text-foreground font-bold block">
          Default Reading Atmosphere & Theme
        </label>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          <button
            type="button"
            onClick={() => onThemeChange('light')}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border border-border text-xs font-mono font-bold transition-all cursor-pointer ${
              theme === 'light'
                ? 'bg-primary/10 text-primary shadow-xs'
                : 'bg-card hover:bg-muted text-muted-foreground'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => onThemeChange('sepia')}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border border-border text-xs font-mono font-bold transition-all cursor-pointer ${
              theme === 'sepia'
                ? 'bg-primary/10 text-primary shadow-xs'
                : 'bg-card hover:bg-muted text-muted-foreground'
            }`}
          >
            <Coffee className="w-4 h-4" />
            <span>Sepia</span>
          </button>

          <button
            type="button"
            onClick={() => onThemeChange('dark')}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border border-border text-xs font-mono font-bold transition-all cursor-pointer ${
              theme === 'dark'
                ? 'bg-primary/10 text-primary shadow-xs'
                : 'bg-card hover:bg-muted text-muted-foreground'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span>Dark</span>
          </button>
        </div>
      </div>

      {/* Catalog Sticky Navigation Mode */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <label className="text-xs font-mono text-foreground font-bold block">
            Catalog Navigation & Sticky Scroll
          </label>
          <span className="text-[11px] font-mono text-muted-foreground">
            {stickyScrollEnabled ? 'Smart Auto-Hide Active' : 'Always Fixed Active'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onStickyScrollChange(true)}
            className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all cursor-pointer ${
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
              Directional scroll auto-hides header and filter bar during browsing to maximize book reading space.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onStickyScrollChange(false)}
            className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all cursor-pointer ${
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
              Keeps the header and filter toolbar stationary at the top of your screen at all times.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};


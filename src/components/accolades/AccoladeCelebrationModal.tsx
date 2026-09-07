'use client';

import React, { useEffect, useCallback } from 'react';
import {
  Flame,
  Calendar,
  Sparkles,
  BookOpen,
  Headphones,
  Scroll,
  Compass,
  Feather,
  Palette,
  Crown,
  Award,
  X,
  Check,
} from 'lucide-react';
import { AccoladeDefinition } from '@/types/accolades.types';
import { ACCOLADE_TIER_CONFIG } from '@/config/accolades-config';
import { useAccoladesStore } from '@/stores/useAccoladesStore';

const ICON_MAP: Record<string, React.ElementType> = {
  Flame,
  Calendar,
  Sparkles,
  BookOpen,
  Headphones,
  Scroll,
  Compass,
  Feather,
  Palette,
  Crown,
  Award,
};

export interface AccoladeCelebrationModalProps {
  accolade?: AccoladeDefinition | null;
  onDismiss?: () => void;
}

export function AccoladeCelebrationModal({
  accolade: propAccolade,
  onDismiss: propOnDismiss,
}: AccoladeCelebrationModalProps = {}) {
  const storeActiveCelebration = useAccoladesStore((s) => s.activeCelebration);
  const storeDismissCelebration = useAccoladesStore((s) => s.dismissCelebration);

  const activeAccolade = propAccolade !== undefined ? propAccolade : storeActiveCelebration;
  const handleDismiss = propOnDismiss || storeDismissCelebration;

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeAccolade) {
        handleDismiss();
      }
    },
    [activeAccolade, handleDismiss]
  );

  useEffect(() => {
    if (activeAccolade) {
      window.addEventListener('keydown', onKeyDown);
      // Tactile celebration vibration pattern on mobile/tablet (double tap)
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([35, 60, 35]);
        } catch {
          // Ignore vibration permission issues
        }
      }
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeAccolade, onKeyDown]);

  if (!activeAccolade) return null;

  const tierConfig = ACCOLADE_TIER_CONFIG[activeAccolade.tier];
  const IconComponent = ICON_MAP[activeAccolade.iconName] || Award;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      data-testid="accolade-celebration-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleDismiss}
    >
      <div
        className={`relative w-full max-w-md bg-card border ${tierConfig.cardBorder} rounded-2xl p-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ornate Background Glow */}
        <div
          className="pointer-events-none absolute -top-24 -left-24 w-64 h-64 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: tierConfig.sealColor }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-24 w-64 h-64 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: tierConfig.sealColor }}
        />

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss celebration"
          className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Ornate Classical Frame */}
        <div className="border border-border rounded-xl p-6 text-center flex flex-col items-center">
          {/* Ribbon Header */}
          <div className="mb-4">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-serif font-medium tracking-wider uppercase border shadow-xs ${tierConfig.ribbonBg}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Ex-Libris Accolade Bestowed
            </span>
          </div>

          {/* Wax-Seal Medallion */}
          <div className="relative my-2">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center border-2 shadow-lg ${tierConfig.badgeBg} ${tierConfig.badgeBorder}`}
            >
              <IconComponent className={`w-10 h-10 ${tierConfig.badgeText}`} />
            </div>
            {/* Wax Seal Stamp Rim */}
            <div
              className="absolute -inset-1 rounded-full border border-dashed opacity-40 animate-pulse pointer-events-none"
              style={{ borderColor: tierConfig.sealColor }}
            />
          </div>

          {/* Title and Latin Motto */}
          <h3
            id="celebration-title"
            className="font-serif font-bold text-2xl text-foreground tracking-tight mt-4"
          >
            {activeAccolade.title}
          </h3>

          <p className="font-serif italic text-sm text-primary tracking-wide mt-1">
            &ldquo;{activeAccolade.latinMotto}&rdquo;
          </p>

          <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-xs">
            {activeAccolade.description}
          </p>

          {/* Acceptance Button */}
          <div className="mt-6 w-full">
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              Place in Ex-Libris Collection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


'use client';

import React, { useState, useRef, useCallback } from 'react';
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
  Pin,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import {
  AccoladeDefinition,
  AccoladeProgress,
  AccoladeId,
} from '@/types/accolades.types';
import { ACCOLADE_TIER_CONFIG } from '@/config/accolades-config';
import { formatAccoladeProgress } from '@/lib/accolades-engine';

export interface ExLibrisBookplateProps {
  definition: AccoladeDefinition;
  progress: AccoladeProgress;
  onTogglePin?: (id: AccoladeId) => Promise<boolean> | void;
  isPinningDisabled?: boolean;
}

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

export function ExLibrisBookplate({
  definition,
  progress,
  onTogglePin,
  isPinningDisabled = false,
}: ExLibrisBookplateProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [sheenPos, setSheenPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const tierConfig = ACCOLADE_TIER_CONFIG[definition.tier];
  const IconComponent = ICON_MAP[definition.iconName] || Award;
  const isUnlocked = progress.isUnlocked;

  // Desktop 3D perspective tilt calculation
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Max 10deg rotation for tactile physical paper tilt
    const rotX = (y - 0.5) * -12;
    const rotY = (x - 0.5) * 12;

    setRotate({ x: rotX, y: rotY });
    setSheenPos({ x: Math.round(x * 100), y: Math.round(y * 100) });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
    setSheenPos({ x: 50, y: 50 });
  }, []);

  const handlePinClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isUnlocked || !onTogglePin) return;

    // Mobile haptic tap feedback where supported
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        // Safe fallback if permissions restrict vibration
      }
    }

    await onTogglePin(definition.id);
  };

  const formattedDate = progress.unlockedAt
    ? new Date(progress.unlockedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid={`accolade-card-${definition.id}`}
      className={`relative group rounded-xl border p-4 transition-all duration-200 select-none overflow-hidden ${
        isUnlocked
          ? `bg-card shadow-sm hover:shadow-lg ${tierConfig.cardBorder}`
          : 'bg-muted/30 border-dashed border-border/70 opacity-75'
      }`}
      style={{
        perspective: '1000px',
        transform: isHovered
          ? `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale3d(1.02, 1.02, 1.02)`
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
        transition: isHovered ? 'transform 0.05s ease-out' : 'transform 0.3s ease-in-out',
      }}
    >
      {/* Specular sheen overlay */}
      {isHovered && isUnlocked && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-150"
          style={{
            background: `radial-gradient(circle at ${sheenPos.x}% ${sheenPos.y}%, rgba(255,255,255,0.18) 0%, transparent 60%)`,
          }}
        />
      )}

      {/* Classical Woodcut Inner Border Frame */}
      <div className="border border-border/40 rounded-lg p-3.5 relative flex flex-col justify-between h-full min-h-[220px]">
        {/* Top Header Row: Tier Ribbon & Pin Action */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide uppercase border ${tierConfig.ribbonBg}`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: tierConfig.sealColor }}
            />
            {tierConfig.name}
          </span>

          {isUnlocked && onTogglePin && (
            <button
              type="button"
              onClick={handlePinClick}
              disabled={isPinningDisabled && !progress.isPinned}
              aria-label={
                progress.isPinned
                  ? `Unpin ${definition.title}`
                  : `Pin ${definition.title} to showcase`
              }
              aria-pressed={progress.isPinned}
              title={
                progress.isPinned
                  ? 'Unpin from showcase'
                  : isPinningDisabled
                  ? 'Maximum 3 bookplates showcase limit reached'
                  : 'Pin to showcase'
              }
              className={`p-1.5 rounded-md transition-colors ${
                progress.isPinned
                  ? 'text-primary bg-primary/10 hover:bg-primary/20'
                  : isPinningDisabled
                  ? 'text-muted-foreground/40 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Pin
                className={`w-3.5 h-3.5 transition-transform ${
                  progress.isPinned ? 'fill-primary rotate-45' : ''
                }`}
              />
            </button>
          )}
        </div>

        {/* Central Bookplate Medallion & Vignette */}
        <div className="flex flex-col items-center text-center my-auto py-2">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 relative transition-transform duration-300 group-hover:scale-105 border ${
              isUnlocked
                ? `${tierConfig.badgeBg} ${tierConfig.badgeBorder}`
                : 'bg-muted border-border/60 text-muted-foreground'
            }`}
          >
            <IconComponent
              className={`w-7 h-7 ${isUnlocked ? tierConfig.badgeText : 'text-muted-foreground'}`}
            />
            {!isUnlocked && (
              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 border border-border shadow-xs">
                <Lock className="w-3 h-3 text-muted-foreground" />
              </div>
            )}
          </div>

          <h4 className="font-serif font-bold text-base leading-snug tracking-tight text-foreground line-clamp-1">
            {definition.title}
          </h4>

          <p className="font-serif italic text-[11px] text-muted-foreground tracking-wide mt-0.5">
            &ldquo;{definition.latinMotto}&rdquo;
          </p>

          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
            {definition.description}
          </p>
        </div>

        {/* Bottom Progression & Status Footer */}
        <div className="mt-3 pt-2.5 border-t border-border/40">
          {isUnlocked ? (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Unlocked
              </span>
              {formattedDate && <span>{formattedDate}</span>}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Progress</span>
                <span className="font-mono text-[10px]">
                  {formatAccoladeProgress(progress, definition)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(100, progress.percent)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


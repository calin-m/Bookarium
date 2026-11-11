'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type ContentCrossfadeVariant =
  | 'page-turn'
  | 'fade'
  | 'slide-left'
  | 'slide-right';

export interface ContentCrossfadeProps {
  transitionKey: React.Key;
  children: React.ReactNode;
  variant?: ContentCrossfadeVariant;
  className?: string;
  style?: React.CSSProperties;
  dataTestId?: string;
}

/**
 * Canonical motion primitive providing hardware-accelerated tactile content transitions
 * across filter changes, tab switching, and state flips.
 * Enforces `[overflow-anchor:none]` to eliminate scroll-anchoring jumps during DOM replacements,
 * and automatically honors `@media (prefers-reduced-motion: reduce)`.
 */
export const ContentCrossfade: React.FC<ContentCrossfadeProps> = ({
  transitionKey,
  children,
  variant = 'page-turn',
  className = '',
  style,
  dataTestId,
}) => {
  const variantClass = {
    'page-turn': 'animate-page-turn',
    'fade': 'animate-in fade-in duration-150',
    'slide-left': 'animate-view-slide-left',
    'slide-right': 'animate-view-slide-right',
  }[variant];

  return (
    <div
      key={transitionKey}
      className={cn(variantClass, '[overflow-anchor:none]', className)}
      style={style}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
};

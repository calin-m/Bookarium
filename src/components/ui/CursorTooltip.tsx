'use client';

import React from 'react';
import { createPortal } from 'react-dom';

export interface CursorTooltipProps {
  isVisible: boolean;
  mousePos: { x: number; y: number } | null;
  offset?: { x: number; y: number };
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Reusable zero-clipping cursor-tracking portal tooltip.
 * Renders directly into document.body to prevent parent container overflow clipping.
 */
export const CursorTooltip: React.FC<CursorTooltipProps> = ({
  isVisible,
  mousePos,
  offset = { x: 12, y: 14 },
  children,
  className = '',
  testId = 'cursor-tooltip',
}) => {
  if (!isVisible || !mousePos || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      data-testid={testId}
      className={`fixed z-[9999] pointer-events-none items-center transition-opacity duration-150 animate-in fade-in select-none ${className}`}
      style={{
        left: `${mousePos.x}px`,
        top: `${mousePos.y}px`,
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      }}
    >
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-900/90 dark:bg-stone-900/95 text-white text-[10px] font-mono font-medium shadow-xl backdrop-blur-xs border border-white/15 whitespace-nowrap">
        {children}
      </span>
    </div>,
    document.body
  );
};


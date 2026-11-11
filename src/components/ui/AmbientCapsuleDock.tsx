'use client';

import React from 'react';

export interface AmbientCapsuleDockProps {
  effectiveVisible: boolean;
  isDockDimmed: boolean;
  asideTestId: string;
  auraTestId: string;
  ariaLabel: string;
  maxWidthClass?: string;
  className?: string;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
  children: React.ReactNode;
}

/**
 * Shared floating bottom capsule `<aside>` container with hardware-accelerated
 * dark/sepia ambient breathing light aura (`animate-ambient-breathe`) and frosted pill shell.
 */
export const AmbientCapsuleDock: React.FC<AmbientCapsuleDockProps> = ({
  effectiveVisible,
  isDockDimmed,
  asideTestId,
  auraTestId,
  ariaLabel,
  maxWidthClass = 'max-w-[94vw]',
  className = '',
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  children,
}) => {
  return (
    <aside
      className={`fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] inset-x-0 mx-auto w-fit ${maxWidthClass} z-40 transition-all focus-within:opacity-100 focus-within:pointer-events-auto ${
        !effectiveVisible
          ? 'translate-y-24 opacity-0 pointer-events-none duration-300 ease-in-out'
          : isDockDimmed
          ? 'translate-y-0 opacity-30 hover:opacity-100 duration-400 ease-out'
          : 'translate-y-0 opacity-100 duration-150 ease-in'
      } ${className}`.trim()}
      data-testid={asideTestId}
      aria-label={ariaLabel}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
    >
      <div className="relative group/dock-pill">
        {/* Hardware-Accelerated Ambient Light Aura (Dark & Sepia Modes) */}
        <div
          data-testid={auraTestId}
          className={`absolute -inset-1.5 rounded-full pointer-events-none -z-10 blur-md transition-all duration-500
            opacity-0 dark:opacity-60 sepia:opacity-40
            ${isDockDimmed ? 'scale-95 dark:opacity-35 sepia:opacity-25' : 'scale-100 dark:opacity-75 sepia:opacity-55'}
            group-hover/dock-pill:scale-105 group-hover/dock-pill:dark:opacity-90 group-hover/dock-pill:sepia:opacity-70
            bg-[radial-gradient(ellipse_at_center,rgba(217,119,6,0.32)_0%,rgba(245,158,11,0.16)_50%,transparent_80%)]
            motion-safe:animate-ambient-breathe`}
          aria-hidden="true"
        />

        <div className="flex items-center gap-1.5 p-1.5 bg-card/95 backdrop-blur-md border border-border/80 shadow-[0_12px_36px_-4px_rgba(0,0,0,0.22),0_4px_14px_-2px_rgba(0,0,0,0.10)] dark:shadow-[0_0_28px_rgba(217,119,6,0.18),0_12px_44px_rgba(0,0,0,0.7),0_0_0_1px_rgba(217,119,6,0.22)] sepia:shadow-[0_0_24px_rgba(180,83,9,0.16),0_10px_30px_rgba(67,40,24,0.18)] rounded-full text-foreground ring-1 ring-black/5 dark:ring-white/10">
          {children}
        </div>
      </div>
    </aside>
  );
};

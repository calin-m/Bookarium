'use client';

import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDialogFocusTrap } from '@/hooks/useDialogFocusTrap';

/**
 * Splits a comma-separated filter string into trimmed non-empty tokens.
 */
export function splitCsvTokens(csv: string): string[] {
  return csv
    ? csv
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
}

/**
 * Toggles a token inside a comma-separated filter string.
 * Passing an empty `token` clears the entire selection (`''`).
 */
export function toggleCsvToken(csv: string, token: string): string {
  if (!token) {
    return '';
  }
  const current = splitCsvTokens(csv);
  if (current.includes(token)) {
    return current.filter((item) => item !== token).join(',');
  }
  return [...current, token].join(',');
}

export interface BottomSheetDrawerShellProps {
  isOpen: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  dialogTestId: string;
  backdropTestId: string;
  closeBtnTestId?: string;
  resetBtnTestId: string;
  applyBtnTestId: string;
  activeCount?: number;
  activeFilterCount?: number;
  headerPaddingClass?: string;
  bodyClassName?: string;
  onResetAll?: () => void;
  onApply: () => void;
  children: React.ReactNode;
}

/**
 * Shared 60fps GPU-composited bottom sliding sheet modal shell used by
 * `AdvancedFilterDrawer` and `CollectionFilterDrawer`.
 */
export const BottomSheetDrawerShell: React.FC<
  BottomSheetDrawerShellProps
> = ({
  isOpen,
  onClose,
  titleId,
  title,
  subtitle,
  icon,
  dialogTestId,
  backdropTestId,
  closeBtnTestId,
  resetBtnTestId,
  applyBtnTestId,
  activeCount,
  activeFilterCount,
  headerPaddingClass = 'p-4 sm:p-5',
  bodyClassName = 'flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] p-4 sm:p-6 space-y-6',
  onResetAll,
  onApply,
  children,
}) => {
  const resolvedActiveCount = activeFilterCount ?? activeCount ?? 0;
  const sheetDialogRef = useRef<HTMLDivElement>(null);

  useDialogFocusTrap({
    isOpen,
    containerRef: sheetDialogRef,
    onClose,
    autoFocus: false,
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={sheetDialogRef}
          className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none overflow-hidden [contain:strict]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-testid={dialogTestId}
        >
          {/* Click-outside backdrop with 0-raster GPU crossfade & background scroll intercept */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ willChange: 'opacity' }}
            className="fixed inset-0 bg-black/60 pointer-events-auto touch-none"
            onClick={onClose}
            onTouchMove={(e) => e.preventDefault()}
            onWheel={(e) => e.preventDefault()}
            aria-hidden="true"
            data-testid={backdropTestId}
          />

          {/* Bottom Sheet Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
            className="relative w-full max-w-4xl mx-auto max-h-[88dvh] rounded-t-2xl bg-background text-foreground flex flex-col justify-between shadow-2xl border-t border-border overflow-hidden pointer-events-auto z-10 [transform:translateZ(0)]"
          >
            {/* Grab Handle Bar */}
            <div
              className="w-12 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 mb-1 shrink-0"
              aria-hidden="true"
            />

            {/* Drawer Header */}
            <div className={`${headerPaddingClass} border-b border-border flex items-center justify-between bg-background shrink-0`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-border">
                  {icon}
                </div>
                <div>
                  <h3
                    id={titleId}
                    className="font-serif font-bold text-base sm:text-lg leading-tight text-foreground"
                  >
                    {title}
                  </h3>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    {subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Close filters"
                data-testid={closeBtnTestId}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Filter Sections */}
            <div className={bodyClassName}>
              {children}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-5 border-t border-border bg-card flex items-center justify-between gap-3 shrink-0">
              {onResetAll ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetAll}
                  data-testid={resetBtnTestId}
                  className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground gap-1.5"
                  aria-label="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All</span>
                </Button>
              ) : (
                <div />
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={onApply}
                data-testid={applyBtnTestId}
                className="px-6 py-2.5 text-xs font-mono uppercase tracking-wider font-bold rounded-lg bg-primary hover:opacity-90 text-primary-foreground shadow-xs cursor-pointer"
                aria-label="Apply filters"
              >
                Show Results {resolvedActiveCount > 0 ? `(${resolvedActiveCount})` : ''}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
